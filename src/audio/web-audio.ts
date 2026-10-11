import { Effect } from 'effect'
import type { Plugin } from 'obsidian'
import type { DeckId } from '../domain/audio/crossfade'
import { createPlayback, type PlaybackEngine } from './engine'
import { AudioError } from './errors'
import { scheduleGain } from './schedule'

type Nodes = {
	source: AudioBufferSourceNode
	gain: GainNode
	stopped: boolean
}

type LiveAudio = {
	readonly context: AudioContext
	readonly master: GainNode
	readonly buffers: Map<string, AudioBuffer>
	readonly decks: { a?: Nodes; b?: Nodes }
	readonly overlays: Map<string, Nodes>
}

const halt = (nodes: Nodes, at?: number): void => {
	if (nodes.stopped) return
	nodes.stopped = true
	if (at === undefined) nodes.source.stop()
	else nodes.source.stop(at)
}

export const createAudioEngine = (
	plugin: Plugin,
	assets: () => string,
	notice: (message: string) => void,
): PlaybackEngine => {
	let live: LiveAudio | undefined
	const open = (): LiveAudio => {
		if (live !== undefined) return live
		const context = new AudioContext()
		const master = context.createGain()
		master.gain.setValueAtTime(1, context.currentTime)
		master.connect(context.destination)
		live = {
			context,
			master,
			buffers: new Map(),
			decks: {},
			overlays: new Map(),
		}
		return live
	}
	const resume = (audio: LiveAudio): void => {
		void audio.context.resume().catch((cause: unknown) => {
			console.error(cause)
		})
	}
	const connect = (
		audio: LiveAudio,
		buffer: AudioBuffer,
		loop: boolean,
		at: number,
		volume: number,
	): Nodes => {
		const source = audio.context.createBufferSource()
		source.buffer = buffer
		source.loop = loop
		const gain = audio.context.createGain()
		gain.gain.setValueAtTime(volume, at)
		source.connect(gain)
		gain.connect(audio.master)
		source.start(at)
		resume(audio)
		return { source, gain, stopped: false }
	}
	const replace = (deck: DeckId, nodes: Nodes): void => {
		const audio = open()
		const previous = audio.decks[deck]
		if (previous !== undefined) {
			halt(previous)
			previous.source.disconnect()
			previous.gain.disconnect()
		}
		audio.decks[deck] = nodes
	}

	return createPlayback(
		{
			now: () => open().context.currentTime,
			load: path =>
				Effect.gen(function* () {
					const audio = open()
					if (audio.buffers.has(path)) return
					const present = yield* Effect.tryPromise({
						try: () => plugin.app.vault.adapter.exists(path),
						catch: () => new AudioError({ message: `Could not read ${path}.` }),
					})
					if (!present) {
						return yield* Effect.fail(
							new AudioError({ message: `Could not read ${path}.` }),
						)
					}
					const bytes = yield* Effect.tryPromise({
						try: () => plugin.app.vault.adapter.readBinary(path),
						catch: () => new AudioError({ message: `Could not read ${path}.` }),
					})
					const buffer = yield* Effect.tryPromise({
						try: () => audio.context.decodeAudioData(bytes.slice(0)),
						catch: () =>
							new AudioError({ message: `Could not decode ${path}.` }),
					})
					audio.buffers.set(path, buffer)
				}),
			start: start => {
				const audio = open()
				const buffer = audio.buffers.get(`${assets()}/${start.file}`)
				if (buffer === undefined) return
				replace(start.deck, connect(audio, buffer, start.loop, start.at, 0))
			},
			startOverlay: (file, at, volume) => {
				const audio = open()
				const buffer = audio.buffers.get(`${assets()}/${file}`)
				if (buffer === undefined) return
				const previous = audio.overlays.get(file)
				if (previous !== undefined) {
					halt(previous)
					previous.source.disconnect()
					previous.gain.disconnect()
				}
				audio.overlays.set(file, connect(audio, buffer, true, at, volume))
			},
			overlayGain: (file, to) => {
				const audio = live
				const overlay = audio?.overlays.get(file)
				if (overlay === undefined || audio === undefined) return
				overlay.gain.gain.setValueAtTime(to, audio.context.currentTime)
			},
			master: to => {
				const audio = open()
				audio.master.gain.setValueAtTime(to, audio.context.currentTime)
			},
			gain: change => {
				const deck = open().decks[change.deck]
				if (deck === undefined) return
				scheduleGain(deck.gain.gain, change, deck.gain.gain.value)
			},
			stop: stop => {
				const deck = live?.decks[stop.deck]
				if (deck === undefined) return
				halt(deck, stop.at)
			},
			stopOverlay: file => {
				const overlay = live?.overlays.get(file)
				if (overlay === undefined || live === undefined) return
				halt(overlay)
				overlay.source.disconnect()
				overlay.gain.disconnect()
				live.overlays.delete(file)
			},
			close: () => {
				if (live === undefined) return
				for (const deck of [live.decks.a, live.decks.b]) {
					if (deck === undefined) continue
					halt(deck)
					deck.source.disconnect()
					deck.gain.disconnect()
				}
				for (const overlay of live.overlays.values()) {
					halt(overlay)
					overlay.source.disconnect()
					overlay.gain.disconnect()
				}
				live.master.disconnect()
				const closing = live.context.close()
				void closing.catch((cause: unknown) => {
					console.error(cause)
				})
				live = undefined
			},
		},
		assets,
		notice,
	)
}

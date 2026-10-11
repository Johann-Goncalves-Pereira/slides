import { Effect } from 'effect'
import {
	type DeckStart,
	type DeckStop,
	emptyPlayback,
	type GainChange,
	type Playback,
	planCrossfade,
	releaseHolder,
} from '../domain/audio/crossfade'
import type { AudioCue } from '../domain/audio/cues'
import { audioAssetPath } from '../domain/audio/cues'
import { AudioError } from './errors'

export type PlaybackPort = {
	readonly now: () => number
	readonly load: (path: string) => Effect.Effect<void, AudioError>
	readonly start: (start: DeckStart) => void
	readonly startOverlay: (file: string, at: number) => void
	readonly gain: (gain: GainChange) => void
	readonly stop: (stop: DeckStop) => void
	readonly stopOverlay: (file: string) => void
	readonly close: () => void
}

export type PlaybackEngine = {
	readonly play: (
		cue: AudioCue,
		holder: 'reading' | 'leaf',
	) => Effect.Effect<void>
	readonly release: (holder: 'reading' | 'leaf') => Effect.Effect<void>
	readonly overlay: (file: string, enabled: boolean) => Effect.Effect<void>
	readonly snapshot: () => Playback
	readonly close: () => void
}

const messageOf = (cause: unknown): string => {
	if (
		typeof cause === 'object' &&
		cause !== null &&
		'message' in cause &&
		typeof cause.message === 'string'
	) {
		return cause.message
	}
	return 'Could not play audio.'
}

export const createPlayback = (
	port: PlaybackPort,
	assets: () => string,
	notice: (message: string) => void = () => undefined,
): PlaybackEngine => {
	let state = emptyPlayback()
	let generation = 0
	let closed = false

	const silence = (): void => {
		const at = port.now()
		port.stop({ deck: 'a', at })
		port.stop({ deck: 'b', at })
		port.gain({ deck: 'a', to: 0, start: at, end: at })
		port.gain({ deck: 'b', to: 0, start: at, end: at })
		for (const file of state.overlays) port.stopOverlay(file)
	}

	const loadStarts = (
		starts: readonly DeckStart[],
	): Effect.Effect<string | undefined> =>
		Effect.gen(function* () {
			for (const start of starts) {
				const path = yield* Effect.either(
					audioAssetPath(assets(), start.file).pipe(
						Effect.mapError(
							error => new AudioError({ message: error.message }),
						),
					),
				)
				if (path._tag === 'Left') return path.left.message
				const loaded = yield* Effect.either(port.load(path.right))
				if (loaded._tag === 'Left') return messageOf(loaded.left)
			}
			return undefined
		})

	const play: PlaybackEngine['play'] = (cue, holder) =>
		Effect.gen(function* () {
			if (closed) return
			const ticket = generation
			const planned = planCrossfade(state, cue, port.now())
			const failure = yield* loadStarts(planned.starts)
			if (failure !== undefined) {
				notice(failure)
				return
			}
			if (ticket !== generation) return
			const fresh = planCrossfade(state, cue, port.now())
			for (const start of fresh.starts) port.start(start)
			for (const gain of fresh.gains) port.gain(gain)
			for (const stop of fresh.stops) port.stop(stop)
			state = {
				...fresh.next,
				holders: { ...fresh.next.holders, [holder]: true },
			}
		})

	const release: PlaybackEngine['release'] = holder =>
		Effect.sync(() => {
			if (closed) return
			const overlays = state.overlays
			const released = releaseHolder(state, holder)
			if (holder === 'leaf') {
				for (const file of overlays) port.stopOverlay(file)
			}
			if (released.silence) silence()
			state = released.next
		})

	const overlay: PlaybackEngine['overlay'] = (file, enabled) =>
		Effect.gen(function* () {
			if (closed) return
			if (!enabled) {
				port.stopOverlay(file)
				state = {
					...state,
					overlays: state.overlays.filter(current => current !== file),
				}
				return
			}
			if (state.overlays.includes(file)) return
			const path = yield* Effect.either(audioAssetPath(assets(), file))
			if (path._tag === 'Left') {
				notice(path.left.message)
				return
			}
			const loaded = yield* Effect.either(port.load(path.right))
			if (loaded._tag === 'Left') {
				notice(messageOf(loaded.left))
				return
			}
			port.startOverlay(file, port.now())
			state = { ...state, overlays: [...state.overlays, file] }
		})

	return {
		play,
		release,
		overlay,
		snapshot: () => state,
		close: () => {
			if (closed) return
			closed = true
			generation += 1
			silence()
			port.close()
			state = emptyPlayback()
		},
	}
}

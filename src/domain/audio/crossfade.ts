import type { AudioCue } from './cues'

export type DeckId = 'a' | 'b'

export type DeckState = {
	readonly file: string | undefined
	readonly volume: number
}

export type Overlay = {
	readonly file: string
	readonly volume: number
}

export type Playback = {
	readonly decks: { readonly a: DeckState; readonly b: DeckState }
	readonly active: DeckId | undefined
	readonly holders: { readonly reading: boolean; readonly leaf: boolean }
	readonly overlays: readonly Overlay[]
	readonly master: number
}

export type GainChange = {
	readonly deck: DeckId
	readonly to: number
	readonly start: number
	readonly end: number
}

export type DeckStart = {
	readonly deck: DeckId
	readonly file: string
	readonly loop: boolean
	readonly at: number
}

export type DeckStop = {
	readonly deck: DeckId
	readonly at: number
}

export type CrossfadePlan = {
	readonly starts: readonly DeckStart[]
	readonly gains: readonly GainChange[]
	readonly stops: readonly DeckStop[]
	readonly next: Playback
}

const idleDeck = (active: DeckId | undefined): DeckId =>
	active === 'a' ? 'b' : 'a'

const withDeck = (
	playback: Playback,
	deck: DeckId,
	state: DeckState,
	active: DeckId | undefined,
): Playback => ({
	...playback,
	active,
	decks: {
		a: deck === 'a' ? state : playback.decks.a,
		b: deck === 'b' ? state : playback.decks.b,
	},
})

export const emptyPlayback = (): Playback => ({
	decks: {
		a: { file: undefined, volume: 0 },
		b: { file: undefined, volume: 0 },
	},
	active: undefined,
	holders: { reading: false, leaf: false },
	overlays: [],
	master: 1,
})

export const planCrossfade = (
	playback: Playback,
	cue: AudioCue,
	audioTime: number,
): CrossfadePlan => {
	const active = playback.active
	const current = active === undefined ? undefined : playback.decks[active]
	const duration = cue.crossfade / 1000
	if (current?.file === cue.file && active !== undefined) {
		return {
			starts: [],
			gains: [
				{
					deck: active,
					to: cue.volume,
					start: audioTime,
					end: audioTime + duration,
				},
			],
			stops: [],
			next: withDeck(
				playback,
				active,
				{ file: cue.file, volume: cue.volume },
				active,
			),
		}
	}
	const deck = current?.file === undefined ? 'a' : idleDeck(active)
	const fromSilence = current?.file === undefined
	const end = fromSilence ? audioTime : audioTime + duration
	const gains: GainChange[] = [{ deck, to: cue.volume, start: audioTime, end }]
	const stops: DeckStop[] = []
	if (!fromSilence && active !== undefined) {
		gains.unshift({ deck: active, to: 0, start: audioTime, end })
		stops.push({ deck: active, at: end })
	}
	let next = withDeck(
		playback,
		deck,
		{ file: cue.file, volume: cue.volume },
		deck,
	)
	if (!fromSilence && active !== undefined) {
		next = withDeck(next, active, { file: undefined, volume: 0 }, deck)
	}
	return {
		starts: [{ deck, file: cue.file, loop: cue.loop, at: audioTime }],
		gains,
		stops,
		next,
	}
}

export type OverlayGain = {
	readonly file: string
	readonly to: number
}

const unit = (volume: number): number => {
	if (!Number.isFinite(volume)) return 0
	if (volume < 0) return 0
	if (volume > 1) return 1
	return volume
}

export const planOverlayVolume = (
	playback: Playback,
	file: string,
	volume: number,
): { readonly gain: OverlayGain | undefined; readonly next: Playback } => {
	const current = playback.overlays.find(overlay => overlay.file === file)
	if (current === undefined) return { gain: undefined, next: playback }
	const to = unit(volume)
	return {
		gain: { file, to },
		next: {
			...playback,
			overlays: playback.overlays.map(overlay =>
				overlay.file === file ? { file, volume: to } : overlay,
			),
		},
	}
}

export const planMasterVolume = (
	playback: Playback,
	volume: number,
): { readonly master: number; readonly next: Playback } => {
	const master = unit(volume)
	return { master, next: { ...playback, master } }
}

export type HolderRelease = {
	readonly silence: boolean
	readonly next: Playback
}

export const releaseHolder = (
	playback: Playback,
	holder: 'reading' | 'leaf',
): HolderRelease => {
	const holders = { ...playback.holders, [holder]: false }
	const overlays = holder === 'leaf' ? [] : playback.overlays
	const stillHeld = holders.reading || holders.leaf
	if (stillHeld) {
		return {
			silence: false,
			next: { ...playback, holders, overlays },
		}
	}
	return {
		silence: true,
		next: {
			...emptyPlayback(),
			holders,
		},
	}
}

import type { AudioCue } from './cues'

export type DeckId = 'a' | 'b'

export type DeckState = {
	readonly file: string | undefined
	readonly volume: number
}

export type Playback = {
	readonly decks: { readonly a: DeckState; readonly b: DeckState }
	readonly active: DeckId | undefined
	readonly holders: { readonly reading: boolean; readonly leaf: boolean }
	readonly overlays: readonly string[]
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

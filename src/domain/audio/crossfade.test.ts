import { describe, expect, it } from 'vitest'
import { emptyPlayback, planCrossfade, releaseHolder } from './crossfade'

const forest = {
	file: 'ambient_dark_forest.mp3',
	volume: 0.7,
	crossfade: 2500,
	loop: true,
}

const tavern = {
	file: 'tavern.mp3',
	volume: 0.4,
	crossfade: 800,
	loop: false,
}

describe('planCrossfade', () => {
	it('starts one silent deck at the cue volume', () => {
		const plan = planCrossfade(emptyPlayback(), forest, 10)
		expect(plan.starts).toEqual([
			{
				deck: 'a',
				file: 'ambient_dark_forest.mp3',
				loop: true,
				at: 10,
			},
		])
		expect(plan.gains).toEqual([{ deck: 'a', to: 0.7, start: 10, end: 10 }])
		expect(plan.gains.some(gain => gain.deck === 'b')).toBe(false)
		expect(plan.stops).toEqual([])
	})

	it('ramps a new file across the cue crossfade', () => {
		const playing = planCrossfade(emptyPlayback(), forest, 10).next
		const plan = planCrossfade(playing, tavern, 20)
		expect(plan.starts).toEqual([
			{ deck: 'b', file: 'tavern.mp3', loop: false, at: 20 },
		])
		expect(plan.gains).toEqual([
			{ deck: 'a', to: 0, start: 20, end: 20.8 },
			{ deck: 'b', to: 0.4, start: 20, end: 20.8 },
		])
		expect(plan.stops).toEqual([{ deck: 'a', at: 20.8 }])
	})

	it('changes volume of the same file without a second start', () => {
		const playing = planCrossfade(emptyPlayback(), forest, 10).next
		const plan = planCrossfade(playing, { ...forest, volume: 0.2 }, 30)
		expect(plan.starts).toEqual([])
		expect(plan.gains).toEqual([{ deck: 'a', to: 0.2, start: 30, end: 32.5 }])
		expect(plan.stops).toEqual([])
		expect(plan.next.decks.a.file).toBe('ambient_dark_forest.mp3')
	})
})

describe('releaseHolder', () => {
	it('silences playback only when the last holder leaves', () => {
		const playing = planCrossfade(emptyPlayback(), forest, 10).next
		const held = {
			...playing,
			holders: { reading: true, leaf: true },
			overlays: ['rain.mp3'],
		}
		const readingLeft = releaseHolder(held, 'reading')
		expect(readingLeft.silence).toBe(false)
		expect(readingLeft.next.holders).toEqual({ reading: false, leaf: true })
		expect(readingLeft.next.decks.a.file).toBe('ambient_dark_forest.mp3')
		expect(readingLeft.next.overlays).toEqual(['rain.mp3'])

		const leafOnly = releaseHolder(
			{
				...playing,
				holders: { reading: true, leaf: true },
				overlays: ['rain.mp3'],
			},
			'leaf',
		)
		expect(leafOnly.silence).toBe(false)
		expect(leafOnly.next.overlays).toEqual([])
		expect(leafOnly.next.decks.a.file).toBe('ambient_dark_forest.mp3')

		const bothLeft = releaseHolder(readingLeft.next, 'leaf')
		expect(bothLeft.silence).toBe(true)
		expect(bothLeft.next.decks.a.file).toBeUndefined()
		expect(bothLeft.next.decks.b.file).toBeUndefined()
		expect(bothLeft.next.overlays).toEqual([])
		expect(bothLeft.next.active).toBeUndefined()
	})
})

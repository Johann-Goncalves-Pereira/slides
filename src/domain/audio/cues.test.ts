import { describe, expect, it } from 'vitest'
import { parseCues } from './cues'

describe('parseCues', () => {
	it('reads the sample comment', () => {
		const parsed = parseCues(
			'Rain.\n<!-- audio: ambient_dark_forest.mp3, volume: 0.7, crossfade: 2500 -->\n',
		)
		expect(parsed.errors).toEqual([])
		expect(parsed.cues).toEqual([
			{
				file: 'ambient_dark_forest.mp3',
				volume: 0.7,
				crossfade: 2500,
				loop: true,
			},
		])
	})

	it('keeps a later valid cue when an earlier comment is malformed', () => {
		const parsed = parseCues(
			[
				'<!-- audio: not a cue -->',
				'<!-- audio: tavern.mp3, volume: 0.4, crossfade: 800, loop: false -->',
			].join('\n'),
		)
		expect(parsed.errors.map(error => error._tag)).toEqual(['CueError'])
		expect(parsed.cues).toEqual([
			{
				file: 'tavern.mp3',
				volume: 0.4,
				crossfade: 800,
				loop: false,
			},
		])
	})
})

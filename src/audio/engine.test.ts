import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { createPlayback, type PlaybackPort } from './engine'
import { AudioError } from './errors'
import { scheduleGain } from './schedule'

const forest = {
	file: 'ambient_dark_forest.mp3',
	volume: 0.7,
	crossfade: 2500,
	loop: true,
}

describe('createPlayback', () => {
	it('starts one deck after the file loads', async () => {
		const events: string[] = []
		const port: PlaybackPort = {
			now: () => 10,
			load: file => Effect.sync(() => events.push(`load:${file}`)),
			start: start => {
				events.push(`start:${start.deck}:${start.file}`)
			},
			startOverlay: () => undefined,
			gain: gain => {
				events.push(`gain:${gain.deck}:${gain.to}`)
			},
			stop: () => undefined,
			stopOverlay: () => undefined,
			close: () => undefined,
		}
		const playback = createPlayback(port, () => 'Assets')
		await Effect.runPromise(playback.play(forest, 'reading'))
		expect(events).toEqual([
			'load:Assets/ambient_dark_forest.mp3',
			'start:a:ambient_dark_forest.mp3',
			'gain:a:0.7',
		])
		expect(playback.snapshot().decks.a.file).toBe('ambient_dark_forest.mp3')
	})

	it('keeps the previous cue when a load fails', async () => {
		const events: string[] = []
		const notices: string[] = []
		let failNext = false
		const port: PlaybackPort = {
			now: () => 10,
			load: () =>
				failNext
					? Effect.fail(
							new AudioError({ message: 'Could not read tavern.mp3.' }),
						)
					: Effect.void,
			start: start => {
				events.push(start.file)
			},
			startOverlay: () => undefined,
			gain: () => undefined,
			stop: () => undefined,
			stopOverlay: () => undefined,
			close: () => undefined,
		}
		const playback = createPlayback(
			port,
			() => 'Assets',
			message => {
				notices.push(message)
			},
		)
		await Effect.runPromise(playback.play(forest, 'reading'))
		failNext = true
		await Effect.runPromise(
			playback.play(
				{ file: 'tavern.mp3', volume: 0.4, crossfade: 800, loop: true },
				'reading',
			),
		)
		expect(events).toEqual(['ambient_dark_forest.mp3'])
		expect(playback.snapshot().decks.a.file).toBe('ambient_dark_forest.mp3')
		expect(notices).toEqual(['Could not read tavern.mp3.'])
	})
})

describe('scheduleGain', () => {
	it('ramps on the audio clock when the fade has duration', () => {
		const calls: string[] = []
		scheduleGain(
			{
				setValueAtTime: (value, time) => {
					calls.push(`set:${value}@${time}`)
				},
				linearRampToValueAtTime: (value, time) => {
					calls.push(`ramp:${value}@${time}`)
				},
			},
			{ deck: 'a', to: 0, start: 20, end: 20.8 },
			0.7,
		)
		expect(calls).toEqual(['set:0.7@20', 'ramp:0@20.8'])
	})
})

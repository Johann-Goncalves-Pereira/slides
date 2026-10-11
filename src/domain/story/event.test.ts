import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { compareEvents, decodeStoryEvent } from './event'

const coordinate = {
	branchId: 'main',
	chapterOrder: 1,
	sceneIndex: 1,
	beatIndex: 1,
	timestamp: 100,
}

describe('compareEvents', () => {
	it('breaks a shared timestamp with eventId', () => {
		const earlierId = { eventId: 'evt-apply', coordinate }
		const laterId = { eventId: 'evt-clear', coordinate }
		expect(compareEvents(earlierId, laterId)).toBe(-1)
		expect(compareEvents(laterId, earlierId)).toBe(1)
		expect(compareEvents(earlierId, { ...earlierId })).toBe(0)
	})

	it('orders different branches before comparing event ids', () => {
		const alt = {
			eventId: 'zzz',
			coordinate: { ...coordinate, branchId: 'alt' },
		}
		const main = { eventId: 'aaa', coordinate }
		expect(compareEvents(alt, main)).toBe(-1)
	})
})

describe('decodeStoryEvent', () => {
	it('defaults a missing branch to main', async () => {
		const event = await Effect.runPromise(
			decodeStoryEvent({
				eventId: 'evt-1',
				targetEntity: 'Arthur',
				coordinate: {
					chapterOrder: 1,
					sceneIndex: 1,
					beatIndex: 1,
					timestamp: 1,
				},
				type: 'STAT_CHANGE',
				deltas: { HP: 1 },
			}),
		)
		expect(event.coordinate.branchId).toBe('main')
	})

	it('rejects an empty stat map', async () => {
		const result = await Effect.runPromise(
			Effect.either(
				decodeStoryEvent({
					eventId: 'evt-1',
					targetEntity: 'Arthur',
					coordinate: {
						chapterOrder: 1,
						sceneIndex: 1,
						beatIndex: 1,
						timestamp: 1,
					},
					type: 'STAT_CHANGE',
					deltas: {},
				}),
			),
		)
		expect(result._tag).toBe('Left')
	})

	it('rejects an unknown event type', async () => {
		const result = await Effect.runPromise(
			Effect.either(
				decodeStoryEvent({
					eventId: 'evt-1',
					targetEntity: 'Arthur',
					coordinate: {
						chapterOrder: 1,
						sceneIndex: 1,
						beatIndex: 1,
						timestamp: 1,
					},
					type: 'LEVEL_UP',
					deltas: { HP: 1 },
				}),
			),
		)
		expect(result._tag).toBe('Left')
	})
})

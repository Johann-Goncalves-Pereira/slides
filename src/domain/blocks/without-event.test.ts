import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import type { StoryEvent } from '../story/event'
import { withoutEvent } from './without-event'

const coordinate = {
	branchId: 'main',
	chapterOrder: 1,
	sceneIndex: 0,
	beatIndex: 0,
	timestamp: 1,
}

const stat = (eventId: string, delta: number): StoryEvent => ({
	eventId,
	targetEntity: 'Arthur',
	coordinate,
	type: 'STAT_CHANGE',
	deltas: { HP: delta },
})

describe('withoutEvent', () => {
	it('drops one event and leaves the original list unchanged', async () => {
		const events = [stat('evt-1', -20), stat('evt-2', 15), stat('evt-3', 1)]
		const next = await Effect.runPromise(withoutEvent(events, 'evt-2'))
		expect(next.map(event => event.eventId)).toEqual(['evt-1', 'evt-3'])
		expect(events.map(event => event.eventId)).toEqual([
			'evt-1',
			'evt-2',
			'evt-3',
		])
		const missing = await Effect.runPromise(
			Effect.either(withoutEvent(events, 'evt-missing')),
		)
		expect(missing._tag).toBe('Left')
		expect(missing._tag === 'Left' && missing.left._tag).toBe('MissingEvent')
	})
})

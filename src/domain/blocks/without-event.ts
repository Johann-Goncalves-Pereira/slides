import { Data, Effect } from 'effect'
import type { StoryEvent } from '../story/event'

export class MissingEvent extends Data.TaggedError('MissingEvent')<{
	readonly eventId: string
}> {}

export const withoutEvent = (
	events: readonly StoryEvent[],
	eventId: string,
): Effect.Effect<readonly StoryEvent[], MissingEvent> =>
	Effect.gen(function* () {
		if (!events.some(event => event.eventId === eventId)) {
			return yield* new MissingEvent({ eventId })
		}
		return events.filter(event => event.eventId !== eventId)
	})

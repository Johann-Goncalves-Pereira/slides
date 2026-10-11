import { Effect, Option } from 'effect'
import { compareCoordinates, type StoryCoordinate } from './coordinate'
import { RehydrationError } from './errors'
import type { StoryEvent } from './event'
import { Ledger } from './ledger'
import { reduceWorld } from './reduce'
import type { WorldState } from './state'

const tailAfterSnapshot = (
	events: readonly StoryEvent[],
	coordinate: StoryCoordinate,
	snapshot: Option.Option<StoryCoordinate>,
): readonly StoryEvent[] =>
	events.filter(event => {
		if (event.coordinate.branchId !== coordinate.branchId) return false
		if (compareCoordinates(event.coordinate, coordinate) > 0) return false
		if (Option.isNone(snapshot)) return true
		return compareCoordinates(snapshot.value, event.coordinate) < 0
	})

export const rehydrateAt = (
	coordinate: StoryCoordinate,
): Effect.Effect<WorldState, RehydrationError, Ledger> =>
	Effect.gen(function* () {
		const ledger = yield* Ledger
		const snapshot = yield* ledger.latestSnapshotAtOrBefore(coordinate)
		if (
			Option.isSome(snapshot) &&
			compareCoordinates(snapshot.value.coordinate, coordinate) > 0
		) {
			return yield* new RehydrationError({
				message: 'snapshot is after the requested coordinate',
			})
		}
		const events = yield* ledger.events
		const initial = Option.match(snapshot, {
			onNone: () => ledger.initialState,
			onSome: value => value.state,
		})
		const through = Option.map(snapshot, value => value.coordinate)
		return yield* reduceWorld(
			initial,
			tailAfterSnapshot(events, coordinate, through),
		).pipe(
			Effect.mapError(
				cause =>
					new RehydrationError({
						message: 'could not fold the event tail',
						cause,
					}),
			),
		)
	})

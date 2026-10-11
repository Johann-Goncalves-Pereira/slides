import { Context, Effect, Option } from 'effect'
import type { StoryCoordinate } from './coordinate'
import { compareCoordinates } from './coordinate'
import type { RehydrationError } from './errors'
import type { StoryEvent } from './event'
import type { Snapshot } from './snapshot'
import type { WorldState } from './state'

export class Ledger extends Context.Tag('Ledger')<
	Ledger,
	{
		readonly initialState: WorldState
		readonly events: Effect.Effect<readonly StoryEvent[], RehydrationError>
		readonly latestSnapshotAtOrBefore: (
			coordinate: StoryCoordinate,
		) => Effect.Effect<Option.Option<Snapshot>, RehydrationError>
	}
>() {}

const latestAtOrBefore = (
	snapshots: readonly Snapshot[],
	coordinate: StoryCoordinate,
): Option.Option<Snapshot> => {
	const latest = snapshots.reduce<Snapshot | undefined>((best, snapshot) => {
		if (snapshot.coordinate.branchId !== coordinate.branchId) return best
		if (compareCoordinates(snapshot.coordinate, coordinate) > 0) return best
		if (best === undefined) return snapshot
		const order = compareCoordinates(best.coordinate, snapshot.coordinate)
		if (order < 0) return snapshot
		if (order > 0) return best
		return snapshot.eventCount >= best.eventCount ? snapshot : best
	}, undefined)
	return Option.fromNullable(latest)
}

export const makeMemoryLedger = (input: {
	readonly initialState: WorldState
	readonly events: readonly StoryEvent[]
	readonly snapshots: readonly Snapshot[]
}): Context.Tag.Service<typeof Ledger> => ({
	initialState: input.initialState,
	events: Effect.succeed(input.events),
	latestSnapshotAtOrBefore: coordinate =>
		Effect.succeed(latestAtOrBefore(input.snapshots, coordinate)),
})

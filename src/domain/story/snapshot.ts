import { Effect, Schema } from 'effect'
import { compareCoordinates, StoryCoordinate } from './coordinate'
import { compareEvents, type StoryEvent } from './event'
import type { ReduceError } from './reduce'
import { reduceWorld } from './reduce'
import { type WorldState as World, WorldState } from './state'

const PositiveInt = Schema.Int.pipe(Schema.positive())

export const SnapshotPolicy = Schema.Struct({
	everyNEvents: PositiveInt,
	everyNChapters: PositiveInt,
})

export type SnapshotPolicy = typeof SnapshotPolicy.Type

export const manuscriptSnapshotPolicy: SnapshotPolicy = {
	everyNEvents: 250,
	everyNChapters: 25,
}

export const Snapshot = Schema.Struct({
	snapshotId: Schema.NonEmptyString,
	coordinate: StoryCoordinate,
	eventCount: Schema.NonNegativeInt,
	state: WorldState,
})

export type Snapshot = typeof Snapshot.Type

const groupByBranch = (
	events: readonly StoryEvent[],
): ReadonlyMap<string, readonly StoryEvent[]> => {
	const branches = new Map<string, StoryEvent[]>()
	for (const event of events) {
		const branchId = event.coordinate.branchId
		const current = branches.get(branchId) ?? []
		branches.set(branchId, [...current, event])
	}
	return branches
}

const bucketEvents = (
	events: readonly StoryEvent[],
): readonly StoryEvent[][] => {
	const ordered = [...events].sort((left, right) => compareEvents(left, right))
	const buckets: StoryEvent[][] = []
	for (const event of ordered) {
		const last = buckets.at(-1)
		const head = last?.[0]
		if (
			last !== undefined &&
			head !== undefined &&
			compareCoordinates(head.coordinate, event.coordinate) === 0
		) {
			last.push(event)
			continue
		}
		buckets.push([event])
	}
	return buckets
}

const snapshotIdFor = (
	coordinate: StoryCoordinate,
	eventCount: number,
): string =>
	`${coordinate.branchId}@${coordinate.chapterOrder}.${coordinate.sceneIndex}.${coordinate.beatIndex}.${coordinate.timestamp}#${eventCount}`

const nextEventMark = (
	eventCount: number,
	mark: number,
	step: number,
): number => {
	if (eventCount < mark) return mark
	const steps = Math.floor((eventCount - mark) / step) + 1
	return mark + steps * step
}

const snapshotsForBranch = (
	initial: World,
	events: readonly StoryEvent[],
	policy: SnapshotPolicy,
): Effect.Effect<readonly Snapshot[], ReduceError> =>
	Effect.gen(function* () {
		const buckets = bucketEvents(events)
		const snapshots: Snapshot[] = []
		let state = initial
		let eventCount = 0
		let mark = policy.everyNEvents
		for (let index = 0; index < buckets.length; index++) {
			const bucket = buckets[index]
			if (bucket === undefined) continue
			state = yield* reduceWorld(state, bucket)
			eventCount += bucket.length
			const last = bucket.at(-1)
			if (last === undefined) continue
			const next = buckets[index + 1]?.[0]
			const chapterEnded =
				next === undefined ||
				next.coordinate.chapterOrder > last.coordinate.chapterOrder
			const chapterCheckpoint =
				chapterEnded &&
				last.coordinate.chapterOrder > 0 &&
				last.coordinate.chapterOrder % policy.everyNChapters === 0
			const eventCheckpoint = eventCount >= mark
			if (!chapterCheckpoint && !eventCheckpoint) continue
			snapshots.push({
				snapshotId: snapshotIdFor(last.coordinate, eventCount),
				coordinate: last.coordinate,
				eventCount,
				state,
			})
			if (eventCheckpoint)
				mark = nextEventMark(eventCount, mark, policy.everyNEvents)
		}
		return snapshots
	})

export const buildSnapshots = (
	initial: World,
	events: readonly StoryEvent[],
	policy: SnapshotPolicy,
): Effect.Effect<readonly Snapshot[], ReduceError> =>
	Effect.gen(function* () {
		const snapshots: Snapshot[] = []
		for (const branchEvents of groupByBranch(events).values()) {
			const branchSnapshots = yield* snapshotsForBranch(
				initial,
				branchEvents,
				policy,
			)
			snapshots.push(...branchSnapshots)
		}
		return [...snapshots].sort((left, right) => {
			const coordinate = compareCoordinates(left.coordinate, right.coordinate)
			if (coordinate !== 0) return coordinate
			return left.eventCount - right.eventCount
		})
	})

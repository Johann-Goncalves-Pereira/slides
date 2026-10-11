import { Schema } from 'effect'
import { compareCoordinates, StoryCoordinate } from './coordinate'

const StatDeltas = Schema.Record({
	key: Schema.NonEmptyString,
	value: Schema.Finite,
}).pipe(
	Schema.filter(
		deltas => Object.keys(deltas).length > 0 || 'stat deltas must be non-empty',
	),
)

export const StatChangeEvent = Schema.Struct({
	eventId: Schema.NonEmptyString,
	targetEntity: Schema.NonEmptyString,
	coordinate: StoryCoordinate,
	type: Schema.Literal('STAT_CHANGE'),
	deltas: StatDeltas,
})

export const AffinityShiftEvent = Schema.Struct({
	eventId: Schema.NonEmptyString,
	targetEntity: Schema.NonEmptyString,
	coordinate: StoryCoordinate,
	type: Schema.Literal('AFFINITY_SHIFT'),
	object: Schema.NonEmptyString,
	axis: Schema.NonEmptyString,
	delta: Schema.Finite,
})

const PositiveInt = Schema.Int.pipe(Schema.positive())

export const InventoryMutationEvent = Schema.Struct({
	eventId: Schema.NonEmptyString,
	targetEntity: Schema.NonEmptyString,
	coordinate: StoryCoordinate,
	type: Schema.Literal('INVENTORY_MUTATION'),
	op: Schema.Literal('ADD', 'REMOVE'),
	itemId: Schema.NonEmptyString,
	name: Schema.NonEmptyString,
	quantity: PositiveInt,
})

export const StatusEffectEvent = Schema.Struct({
	eventId: Schema.NonEmptyString,
	targetEntity: Schema.NonEmptyString,
	coordinate: StoryCoordinate,
	type: Schema.Literal('STATUS_EFFECT'),
	op: Schema.Literal('APPLY', 'CLEAR'),
	name: Schema.NonEmptyString,
	durationScenes: Schema.optional(Schema.NonNegativeInt),
})

export const StoryEvent = Schema.Union(
	StatChangeEvent,
	AffinityShiftEvent,
	InventoryMutationEvent,
	StatusEffectEvent,
)

export type StoryEvent = typeof StoryEvent.Type

export const decodeStoryEvent = Schema.decodeUnknown(StoryEvent)

type OrderedEvent = {
	readonly eventId: string
	readonly coordinate: StoryCoordinate
}

export const compareEvents = (
	left: OrderedEvent,
	right: OrderedEvent,
): -1 | 0 | 1 => {
	const coordinate = compareCoordinates(left.coordinate, right.coordinate)
	if (coordinate !== 0) return coordinate
	if (left.eventId < right.eventId) return -1
	if (left.eventId > right.eventId) return 1
	return 0
}

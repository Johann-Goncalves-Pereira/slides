import { Data, Effect, Schema } from 'effect'
import type { StoryCoordinate } from '../story/coordinate'
import type { StoryEvent } from '../story/event'
import type { EventSidecar } from '../vault/frontmatter'

export class ExtractionError extends Data.TaggedError('ExtractionError')<{
	readonly message: string
}> {}

const StatDeltas = Schema.Record({
	key: Schema.NonEmptyString,
	value: Schema.Finite,
}).pipe(
	Schema.filter(
		deltas => Object.keys(deltas).length > 0 || 'stat deltas must be non-empty',
	),
)

const ArrowTarget = Schema.NonEmptyString.pipe(
	Schema.filter(target => {
		const parts = target.split('->')
		return (
			(parts.length === 2 &&
				(parts[0]?.length ?? 0) > 0 &&
				(parts[1]?.length ?? 0) > 0) ||
			'affinity target must be Subject->Object'
		)
	}),
)

const OneAxis = Schema.Record({
	key: Schema.NonEmptyString,
	value: Schema.Finite,
}).pipe(
	Schema.filter(
		payload =>
			Object.keys(payload).length === 1 ||
			'affinity payload must name one axis',
	),
)

const StatInput = Schema.Struct({
	type: Schema.Literal('STAT_CHANGE'),
	targetEntity: Schema.NonEmptyString,
	deltas: StatDeltas,
	eventId: Schema.optional(Schema.NonEmptyString),
})

const AffinityInput = Schema.Struct({
	type: Schema.Literal('AFFINITY_SHIFT'),
	targetEntity: Schema.NonEmptyString,
	object: Schema.NonEmptyString,
	axis: Schema.NonEmptyString,
	delta: Schema.Finite,
	eventId: Schema.optional(Schema.NonEmptyString),
})

const AffinityArrowInput = Schema.Struct({
	type: Schema.Literal('AFFINITY_SHIFT'),
	targetEntity: ArrowTarget,
	payload: OneAxis,
	eventId: Schema.optional(Schema.NonEmptyString),
})

const InventoryInput = Schema.Struct({
	type: Schema.Literal('INVENTORY_MUTATION'),
	targetEntity: Schema.NonEmptyString,
	op: Schema.Literal('ADD', 'REMOVE'),
	itemId: Schema.NonEmptyString,
	name: Schema.NonEmptyString,
	quantity: Schema.Int.pipe(Schema.positive()),
	eventId: Schema.optional(Schema.NonEmptyString),
})

const StatusInput = Schema.Struct({
	type: Schema.Literal('STATUS_EFFECT'),
	targetEntity: Schema.NonEmptyString,
	op: Schema.Literal('APPLY', 'CLEAR'),
	name: Schema.NonEmptyString,
	durationScenes: Schema.optional(Schema.NonNegativeInt),
	eventId: Schema.optional(Schema.NonEmptyString),
})

const FlagInput = Schema.Struct({
	type: Schema.Literal('FLAG_SET'),
	flag: Schema.NonEmptyString,
	value: Schema.Boolean,
	eventId: Schema.optional(Schema.NonEmptyString),
})

const MembershipInput = Schema.Struct({
	type: Schema.Literal('MEMBERSHIP'),
	targetEntity: Schema.NonEmptyString,
	op: Schema.Literal('JOIN', 'LEAVE'),
	factionId: Schema.NonEmptyString,
	eventId: Schema.optional(Schema.NonEmptyString),
})

const LocationInput = Schema.Struct({
	type: Schema.Literal('LOCATION_SET'),
	targetEntity: Schema.NonEmptyString,
	regionId: Schema.NonEmptyString,
	eventId: Schema.optional(Schema.NonEmptyString),
})

const Proposal = Schema.Struct({
	events: Schema.Array(
		Schema.Union(
			StatInput,
			AffinityInput,
			AffinityArrowInput,
			InventoryInput,
			StatusInput,
			FlagInput,
			MembershipInput,
			LocationInput,
		),
	),
})

type ProposalEvent = (typeof Proposal.Type.events)[number]

const axisOf = (payload: {
	readonly [axis: string]: number
}): { readonly axis: string; readonly delta: number } | undefined => {
	for (const [axis, delta] of Object.entries(payload)) {
		return { axis, delta }
	}
	return undefined
}

const storyEvent = (
	event: ProposalEvent,
	eventId: string,
	coordinate: StoryCoordinate,
): StoryEvent | undefined => {
	if (event.type === 'STAT_CHANGE') {
		return {
			eventId,
			targetEntity: event.targetEntity,
			coordinate,
			type: 'STAT_CHANGE',
			deltas: event.deltas,
		}
	}
	if (event.type === 'AFFINITY_SHIFT' && 'payload' in event) {
		const axis = axisOf(event.payload)
		const parts = event.targetEntity.split('->')
		const targetEntity = parts[0]
		const object = parts[1]
		if (
			axis === undefined ||
			targetEntity === undefined ||
			object === undefined
		) {
			return undefined
		}
		return {
			eventId,
			targetEntity,
			object,
			axis: axis.axis,
			delta: axis.delta,
			type: 'AFFINITY_SHIFT',
			coordinate,
		}
	}
	if (event.type === 'AFFINITY_SHIFT') {
		return {
			eventId,
			targetEntity: event.targetEntity,
			object: event.object,
			axis: event.axis,
			delta: event.delta,
			type: 'AFFINITY_SHIFT',
			coordinate,
		}
	}
	if (event.type === 'INVENTORY_MUTATION') {
		return {
			eventId,
			targetEntity: event.targetEntity,
			coordinate,
			type: 'INVENTORY_MUTATION',
			op: event.op,
			itemId: event.itemId,
			name: event.name,
			quantity: event.quantity,
		}
	}
	if (event.type === 'STATUS_EFFECT') {
		if (event.durationScenes === undefined) {
			return {
				eventId,
				targetEntity: event.targetEntity,
				coordinate,
				type: 'STATUS_EFFECT',
				op: event.op,
				name: event.name,
			}
		}
		return {
			eventId,
			targetEntity: event.targetEntity,
			coordinate,
			type: 'STATUS_EFFECT',
			op: event.op,
			name: event.name,
			durationScenes: event.durationScenes,
		}
	}
	if (event.type === 'FLAG_SET') {
		return {
			eventId,
			coordinate,
			type: 'FLAG_SET',
			flag: event.flag,
			value: event.value,
		}
	}
	if (event.type === 'MEMBERSHIP') {
		return {
			eventId,
			targetEntity: event.targetEntity,
			coordinate,
			type: 'MEMBERSHIP',
			op: event.op,
			factionId: event.factionId,
		}
	}
	return {
		eventId,
		targetEntity: event.targetEntity,
		coordinate,
		type: 'LOCATION_SET',
		regionId: event.regionId,
	}
}

export const decodeProposal = (
	input: unknown,
	coordinate: StoryCoordinate,
	existingEventIds: readonly string[],
): Effect.Effect<readonly StoryEvent[], ExtractionError> =>
	Effect.gen(function* () {
		const parsed = yield* Schema.decodeUnknown(Proposal)(input).pipe(
			Effect.mapError(
				() =>
					new ExtractionError({
						message: 'Proposal could not be decoded.',
					}),
			),
		)
		const events: StoryEvent[] = []
		const seen = new Set(existingEventIds)
		for (const [index, event] of parsed.events.entries()) {
			const eventId = event.eventId ?? `extract:${index}`
			if (seen.has(eventId)) {
				return yield* Effect.fail(
					new ExtractionError({
						message: `Duplicate event id ${eventId}.`,
					}),
				)
			}
			const mapped = storyEvent(event, eventId, coordinate)
			if (mapped === undefined) {
				return yield* Effect.fail(
					new ExtractionError({
						message: 'Proposal could not be decoded.',
					}),
				)
			}
			seen.add(eventId)
			events.push(mapped)
		}
		return events
	})

export const applyProposal = (
	sidecar: EventSidecar,
	input: unknown,
	coordinate: StoryCoordinate,
): Effect.Effect<EventSidecar, ExtractionError> =>
	Effect.map(
		decodeProposal(
			input,
			coordinate,
			sidecar.events.map(event => event.eventId),
		),
		events => ({
			...sidecar,
			events: [...sidecar.events, ...events],
		}),
	)

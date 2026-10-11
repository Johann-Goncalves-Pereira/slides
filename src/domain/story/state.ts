import { Schema } from 'effect'
import { StoryCoordinate } from './coordinate'

const PositiveInt = Schema.Int.pipe(Schema.positive())

export const InventoryItem = Schema.Struct({
	itemId: Schema.NonEmptyString,
	name: Schema.NonEmptyString,
	quantity: PositiveInt,
})

export type InventoryItem = typeof InventoryItem.Type

export const Affinity = Schema.Struct({
	object: Schema.NonEmptyString,
	axis: Schema.NonEmptyString,
	score: Schema.Finite,
})

export type Affinity = typeof Affinity.Type

export const ActiveStatus = Schema.Struct({
	name: Schema.NonEmptyString,
	durationScenes: Schema.optional(Schema.NonNegativeInt),
	since: Schema.optional(StoryCoordinate),
})

export type ActiveStatus = typeof ActiveStatus.Type

export const CharacterState = Schema.Struct({
	characterId: Schema.NonEmptyString,
	name: Schema.NonEmptyString,
	stats: Schema.Record({
		key: Schema.NonEmptyString,
		value: Schema.Finite,
	}),
	inventory: Schema.Array(InventoryItem),
	affinities: Schema.Array(Affinity),
	activeStatuses: Schema.Array(ActiveStatus),
	factions: Schema.optionalWith(Schema.Array(Schema.NonEmptyString), {
		default: () => [],
	}),
	location: Schema.optional(Schema.NonEmptyString),
	lastUpdatedCoordinate: StoryCoordinate,
})

export type CharacterState = typeof CharacterState.Type

export const EntityKind = Schema.Literal(
	'faction',
	'artifact',
	'region',
	'spell',
	'lore',
)

export const WorldEntity = Schema.Struct({
	entityId: Schema.NonEmptyString,
	name: Schema.NonEmptyString,
	kind: EntityKind,
})

export type WorldEntity = typeof WorldEntity.Type

const FlagMap = Schema.Record({
	key: Schema.NonEmptyString,
	value: Schema.Boolean,
})

const EntityMap = Schema.Record({
	key: Schema.NonEmptyString,
	value: WorldEntity,
})

export const WorldState = Schema.Struct({
	characters: Schema.Record({
		key: Schema.NonEmptyString,
		value: CharacterState,
	}),
	globalFlags: Schema.optionalWith(FlagMap, { default: () => ({}) }),
	entities: Schema.optionalWith(EntityMap, { default: () => ({}) }),
}).pipe(
	Schema.filter(world => {
		for (const [id, character] of Object.entries(world.characters)) {
			if (character.characterId !== id) {
				return 'characterId must match its world key'
			}
		}
		for (const [id, entity] of Object.entries(world.entities)) {
			if (entity.entityId !== id) {
				return 'entityId must match its world key'
			}
		}
		return true
	}),
)

export type WorldState = typeof WorldState.Type

export const decodeWorldState = Schema.decodeUnknown(WorldState)

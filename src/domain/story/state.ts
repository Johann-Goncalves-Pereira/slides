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
	lastUpdatedCoordinate: StoryCoordinate,
})

export type CharacterState = typeof CharacterState.Type

export const WorldState = Schema.Struct({
	characters: Schema.Record({
		key: Schema.NonEmptyString,
		value: CharacterState,
	}),
}).pipe(
	Schema.filter(world => {
		for (const [id, character] of Object.entries(world.characters)) {
			if (character.characterId !== id) {
				return 'characterId must match its world key'
			}
		}
		return true
	}),
)

export type WorldState = typeof WorldState.Type

export const decodeWorldState = Schema.decodeUnknown(WorldState)

import { Effect } from 'effect'
import { InsufficientQuantity, UnknownEntity } from './errors'
import { compareEvents, type StoryEvent } from './event'
import type {
	ActiveStatus,
	CharacterState,
	InventoryItem,
	WorldEntity,
	WorldState,
} from './state'

const withCharacter = (
	world: WorldState,
	character: CharacterState,
): WorldState => ({
	...world,
	characters: {
		...world.characters,
		[character.characterId]: character,
	},
})

type StatChange = Extract<StoryEvent, { type: 'STAT_CHANGE' }>
type AffinityShift = Extract<StoryEvent, { type: 'AFFINITY_SHIFT' }>
type InventoryMutation = Extract<StoryEvent, { type: 'INVENTORY_MUTATION' }>
type StatusEffect = Extract<StoryEvent, { type: 'STATUS_EFFECT' }>
type OverrideSync = Extract<StoryEvent, { type: 'OVERRIDE_SYNC' }>
type FlagSet = Extract<StoryEvent, { type: 'FLAG_SET' }>
type Membership = Extract<StoryEvent, { type: 'MEMBERSHIP' }>
type LocationSet = Extract<StoryEvent, { type: 'LOCATION_SET' }>

export type ReduceError = UnknownEntity | InsufficientQuantity

const requireCharacter = (
	world: WorldState,
	targetEntity: string,
	eventId: string,
): Effect.Effect<CharacterState, UnknownEntity> => {
	const character = world.characters[targetEntity]
	if (character === undefined) {
		return Effect.fail(new UnknownEntity({ targetEntity, eventId }))
	}
	return Effect.succeed(character)
}

const applyStatChange = (
	world: WorldState,
	event: StatChange,
): Effect.Effect<WorldState, UnknownEntity> => {
	const character = world.characters[event.targetEntity]
	if (character === undefined) {
		return Effect.fail(
			new UnknownEntity({
				targetEntity: event.targetEntity,
				eventId: event.eventId,
			}),
		)
	}
	const stats: { [stat: string]: number } = { ...character.stats }
	for (const [stat, delta] of Object.entries(event.deltas)) {
		stats[stat] = (stats[stat] ?? 0) + delta
	}
	return Effect.succeed(
		withCharacter(world, {
			...character,
			stats,
			lastUpdatedCoordinate: event.coordinate,
		}),
	)
}

const applyAffinity = (
	world: WorldState,
	event: AffinityShift,
): Effect.Effect<WorldState, UnknownEntity> => {
	const character = world.characters[event.targetEntity]
	if (character === undefined) {
		return Effect.fail(
			new UnknownEntity({
				targetEntity: event.targetEntity,
				eventId: event.eventId,
			}),
		)
	}
	const existing = character.affinities.findIndex(
		affinity =>
			affinity.object === event.object && affinity.axis === event.axis,
	)
	const affinities =
		existing === -1
			? [
					...character.affinities,
					{ object: event.object, axis: event.axis, score: event.delta },
				]
			: character.affinities.map((affinity, index) =>
					index === existing
						? { ...affinity, score: affinity.score + event.delta }
						: affinity,
				)
	return Effect.succeed(
		withCharacter(world, {
			...character,
			affinities,
			lastUpdatedCoordinate: event.coordinate,
		}),
	)
}

const applyInventory = (
	world: WorldState,
	event: InventoryMutation,
): Effect.Effect<WorldState, ReduceError> =>
	Effect.gen(function* () {
		const character = yield* requireCharacter(
			world,
			event.targetEntity,
			event.eventId,
		)
		const held =
			character.inventory.find(item => item.itemId === event.itemId)
				?.quantity ?? 0
		if (event.op === 'REMOVE' && held < event.quantity) {
			return yield* new InsufficientQuantity({
				targetEntity: event.targetEntity,
				itemId: event.itemId,
				held,
				requested: event.quantity,
				eventId: event.eventId,
			})
		}
		const inventory =
			event.op === 'ADD'
				? addItem(character.inventory, event, held)
				: removeItem(character.inventory, event, held)
		return withCharacter(world, {
			...character,
			inventory,
			lastUpdatedCoordinate: event.coordinate,
		})
	})

const addItem = (
	inventory: readonly InventoryItem[],
	event: InventoryMutation,
	held: number,
): readonly InventoryItem[] => {
	if (held === 0) {
		return [
			...inventory,
			{
				itemId: event.itemId,
				name: event.name,
				quantity: event.quantity,
			},
		]
	}
	return inventory.map(item =>
		item.itemId === event.itemId
			? { ...item, name: event.name, quantity: held + event.quantity }
			: item,
	)
}

const removeItem = (
	inventory: readonly InventoryItem[],
	event: InventoryMutation,
	held: number,
): readonly InventoryItem[] => {
	const remaining = held - event.quantity
	if (remaining === 0) {
		return inventory.filter(item => item.itemId !== event.itemId)
	}
	return inventory.map(item =>
		item.itemId === event.itemId
			? { ...item, name: event.name, quantity: remaining }
			: item,
	)
}

const applyStatus = (
	world: WorldState,
	event: StatusEffect,
): Effect.Effect<WorldState, UnknownEntity> =>
	Effect.gen(function* () {
		const character = yield* requireCharacter(
			world,
			event.targetEntity,
			event.eventId,
		)
		const without = character.activeStatuses.filter(
			status => status.name !== event.name,
		)
		const activeStatuses =
			event.op === 'CLEAR' ? without : [...without, statusFrom(event)]
		return withCharacter(world, {
			...character,
			activeStatuses,
			lastUpdatedCoordinate: event.coordinate,
		})
	})

const statusFrom = (event: StatusEffect): ActiveStatus =>
	event.durationScenes === undefined
		? { name: event.name }
		: {
				name: event.name,
				durationScenes: event.durationScenes,
				since: event.coordinate,
			}

const requireKind = (
	world: WorldState,
	entityId: string,
	eventId: string,
	kind: WorldEntity['kind'],
): Effect.Effect<WorldEntity, UnknownEntity> => {
	const entity = world.entities[entityId]
	if (entity === undefined || entity.kind !== kind) {
		return Effect.fail(new UnknownEntity({ targetEntity: entityId, eventId }))
	}
	return Effect.succeed(entity)
}

const applyFlag = (world: WorldState, event: FlagSet): WorldState => ({
	...world,
	globalFlags: { ...world.globalFlags, [event.flag]: event.value },
})

const applyMembership = (
	world: WorldState,
	event: Membership,
): Effect.Effect<WorldState, UnknownEntity> =>
	Effect.gen(function* () {
		const character = yield* requireCharacter(
			world,
			event.targetEntity,
			event.eventId,
		)
		yield* requireKind(world, event.factionId, event.eventId, 'faction')
		const already = character.factions.includes(event.factionId)
		const factions =
			event.op === 'JOIN'
				? already
					? character.factions
					: [...character.factions, event.factionId]
				: character.factions.filter(factionId => factionId !== event.factionId)
		return withCharacter(world, {
			...character,
			factions,
			lastUpdatedCoordinate: event.coordinate,
		})
	})

const applyLocation = (
	world: WorldState,
	event: LocationSet,
): Effect.Effect<WorldState, UnknownEntity> =>
	Effect.gen(function* () {
		const character = yield* requireCharacter(
			world,
			event.targetEntity,
			event.eventId,
		)
		yield* requireKind(world, event.regionId, event.eventId, 'region')
		return withCharacter(world, {
			...character,
			location: event.regionId,
			lastUpdatedCoordinate: event.coordinate,
		})
	})

const applyOverride = (
	world: WorldState,
	event: OverrideSync,
): Effect.Effect<WorldState, UnknownEntity> =>
	Effect.gen(function* () {
		const character = yield* requireCharacter(
			world,
			event.targetEntity,
			event.eventId,
		)
		const stats: { [stat: string]: number } = { ...character.stats }
		for (const [stat, value] of Object.entries(event.stats)) {
			stats[stat] = value
		}
		return withCharacter(world, {
			...character,
			stats,
			lastUpdatedCoordinate: event.coordinate,
		})
	})

const applyEvent = (
	world: WorldState,
	event: StoryEvent,
): Effect.Effect<WorldState, ReduceError> => {
	switch (event.type) {
		case 'STAT_CHANGE':
			return applyStatChange(world, event)
		case 'AFFINITY_SHIFT':
			return applyAffinity(world, event)
		case 'INVENTORY_MUTATION':
			return applyInventory(world, event)
		case 'STATUS_EFFECT':
			return applyStatus(world, event)
		case 'OVERRIDE_SYNC':
			return applyOverride(world, event)
		case 'FLAG_SET':
			return Effect.succeed(applyFlag(world, event))
		case 'MEMBERSHIP':
			return applyMembership(world, event)
		case 'LOCATION_SET':
			return applyLocation(world, event)
	}
}

export const reduceWorld = (
	initial: WorldState,
	events: readonly StoryEvent[],
): Effect.Effect<WorldState, ReduceError> => {
	const ordered = [...events].sort((left, right) => compareEvents(left, right))
	return Effect.reduce(ordered, initial, (world, event) =>
		applyEvent(world, event),
	)
}

import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { decodeStoryEvent } from './event'
import { reduceWorld } from './reduce'
import { decodeWorldState } from './state'

const coordinate = (beatIndex: number, timestamp: number) => ({
	chapterOrder: 1,
	sceneIndex: 1,
	beatIndex,
	timestamp,
})

const arthurWorld = {
	characters: {
		Arthur: {
			characterId: 'Arthur',
			name: 'Arthur',
			stats: { HP: 100 },
			inventory: [],
			affinities: [],
			activeStatuses: [],
			lastUpdatedCoordinate: coordinate(0, 100),
		},
	},
}

const damage = {
	eventId: 'evt-damage',
	targetEntity: 'Arthur',
	coordinate: coordinate(2, 102),
	type: 'STAT_CHANGE',
	deltas: { HP: -20, MP: 5 },
}

const heal = {
	eventId: 'evt-heal',
	targetEntity: 'Arthur',
	coordinate: coordinate(1, 101),
	type: 'STAT_CHANGE',
	deltas: { HP: 15 },
}

describe('reduceWorld', () => {
	it('folds stat deltas from zero when a stat is missing', async () => {
		const initial = await Effect.runPromise(decodeWorldState(arthurWorld))
		const events = [
			await Effect.runPromise(decodeStoryEvent(damage)),
			await Effect.runPromise(decodeStoryEvent(heal)),
		]
		const world = await Effect.runPromise(reduceWorld(initial, events))
		const arthur = world.characters.Arthur
		expect(arthur?.stats.HP).toBe(95)
		expect(arthur?.stats.MP).toBe(5)
		expect(arthur?.lastUpdatedCoordinate.timestamp).toBe(102)
	})

	it('adds affinity deltas on the same axis', async () => {
		const initial = await Effect.runPromise(decodeWorldState(arthurWorld))
		const events = [
			await Effect.runPromise(
				decodeStoryEvent({
					eventId: 'evt-doubt',
					targetEntity: 'Arthur',
					coordinate: coordinate(1, 110),
					type: 'AFFINITY_SHIFT',
					object: 'Merlin',
					axis: 'trust',
					delta: -5,
				}),
			),
			await Effect.runPromise(
				decodeStoryEvent({
					eventId: 'evt-bond',
					targetEntity: 'Arthur',
					coordinate: coordinate(2, 111),
					type: 'AFFINITY_SHIFT',
					object: 'Merlin',
					axis: 'trust',
					delta: 15,
				}),
			),
		]
		const world = await Effect.runPromise(reduceWorld(initial, events))
		expect(world.characters.Arthur?.affinities).toEqual([
			{ object: 'Merlin', axis: 'trust', score: 10 },
		])
	})

	it('adds and removes inventory quantities', async () => {
		const initial = await Effect.runPromise(decodeWorldState(arthurWorld))
		const events = [
			await Effect.runPromise(
				decodeStoryEvent({
					eventId: 'evt-dagger',
					targetEntity: 'Arthur',
					coordinate: coordinate(1, 120),
					type: 'INVENTORY_MUTATION',
					op: 'ADD',
					itemId: 'rusty-dagger',
					name: 'Rusty Dagger',
					quantity: 1,
				}),
			),
			await Effect.runPromise(
				decodeStoryEvent({
					eventId: 'evt-potion',
					targetEntity: 'Arthur',
					coordinate: coordinate(2, 121),
					type: 'INVENTORY_MUTATION',
					op: 'ADD',
					itemId: 'health-potion',
					name: 'Health Potion',
					quantity: 2,
				}),
			),
			await Effect.runPromise(
				decodeStoryEvent({
					eventId: 'evt-drink',
					targetEntity: 'Arthur',
					coordinate: coordinate(3, 122),
					type: 'INVENTORY_MUTATION',
					op: 'REMOVE',
					itemId: 'health-potion',
					name: 'Health Potion',
					quantity: 1,
				}),
			),
		]
		const world = await Effect.runPromise(reduceWorld(initial, events))
		expect(world.characters.Arthur?.inventory).toEqual([
			{ itemId: 'rusty-dagger', name: 'Rusty Dagger', quantity: 1 },
			{ itemId: 'health-potion', name: 'Health Potion', quantity: 1 },
		])
	})

	it('fails when a removal exceeds the quantity held', async () => {
		const initial = await Effect.runPromise(decodeWorldState(arthurWorld))
		const events = [
			await Effect.runPromise(
				decodeStoryEvent({
					eventId: 'evt-potion',
					targetEntity: 'Arthur',
					coordinate: coordinate(1, 130),
					type: 'INVENTORY_MUTATION',
					op: 'ADD',
					itemId: 'health-potion',
					name: 'Health Potion',
					quantity: 1,
				}),
			),
			await Effect.runPromise(
				decodeStoryEvent({
					eventId: 'evt-over',
					targetEntity: 'Arthur',
					coordinate: coordinate(2, 131),
					type: 'INVENTORY_MUTATION',
					op: 'REMOVE',
					itemId: 'health-potion',
					name: 'Health Potion',
					quantity: 3,
				}),
			),
		]
		const result = await Effect.runPromise(
			Effect.either(reduceWorld(initial, events)),
		)
		expect(result._tag).toBe('Left')
		if (result._tag !== 'Left') return
		expect(result.left._tag).toBe('InsufficientQuantity')
		if (result.left._tag !== 'InsufficientQuantity') return
		expect(result.left.held).toBe(1)
		expect(result.left.requested).toBe(3)
		expect(initial.characters.Arthur?.inventory).toEqual([])
	})

	it('replaces a status duration and then clears it', async () => {
		const initial = await Effect.runPromise(decodeWorldState(arthurWorld))
		const applied = await Effect.runPromise(
			decodeStoryEvent({
				eventId: 'evt-poison',
				targetEntity: 'Arthur',
				coordinate: coordinate(1, 140),
				type: 'STATUS_EFFECT',
				op: 'APPLY',
				name: 'Poisoned',
				durationScenes: 3,
			}),
		)
		const replaced = await Effect.runPromise(
			decodeStoryEvent({
				eventId: 'evt-poison-again',
				targetEntity: 'Arthur',
				coordinate: coordinate(2, 141),
				type: 'STATUS_EFFECT',
				op: 'APPLY',
				name: 'Poisoned',
				durationScenes: 1,
			}),
		)
		const cleared = await Effect.runPromise(
			decodeStoryEvent({
				eventId: 'evt-cure',
				targetEntity: 'Arthur',
				coordinate: coordinate(3, 142),
				type: 'STATUS_EFFECT',
				op: 'CLEAR',
				name: 'Poisoned',
			}),
		)
		const poisoned = await Effect.runPromise(
			reduceWorld(initial, [applied, replaced]),
		)
		expect(poisoned.characters.Arthur?.activeStatuses).toEqual([
			{ name: 'Poisoned', durationScenes: 1 },
		])
		const cured = await Effect.runPromise(reduceWorld(poisoned, [cleared]))
		expect(cured.characters.Arthur?.activeStatuses).toEqual([])
	})

	it('fails for an unknown character and leaves the initial world unchanged', async () => {
		const initial = await Effect.runPromise(decodeWorldState(arthurWorld))
		const events = [
			await Effect.runPromise(
				decodeStoryEvent({
					eventId: 'evt-arthur',
					targetEntity: 'Arthur',
					coordinate: coordinate(2, 151),
					type: 'STAT_CHANGE',
					deltas: { HP: -5 },
				}),
			),
			await Effect.runPromise(
				decodeStoryEvent({
					eventId: 'evt-merlin',
					targetEntity: 'Merlin',
					coordinate: coordinate(1, 150),
					type: 'STAT_CHANGE',
					deltas: { HP: -10 },
				}),
			),
		]
		const result = await Effect.runPromise(
			Effect.either(reduceWorld(initial, events)),
		)
		expect(result._tag).toBe('Left')
		if (result._tag !== 'Left') return
		expect(result.left._tag).toBe('UnknownEntity')
		if (result.left._tag !== 'UnknownEntity') return
		expect(result.left.targetEntity).toBe('Merlin')
		expect(result.left.eventId).toBe('evt-merlin')
		expect(initial.characters.Arthur?.stats.HP).toBe(100)
	})

	it('folds events in story order when the array is reversed', async () => {
		const initial = await Effect.runPromise(decodeWorldState(arthurWorld))
		const beat = coordinate(1, 160)
		const clear = await Effect.runPromise(
			decodeStoryEvent({
				eventId: 'evt-clear',
				targetEntity: 'Arthur',
				coordinate: beat,
				type: 'STATUS_EFFECT',
				op: 'CLEAR',
				name: 'Poisoned',
			}),
		)
		const apply = await Effect.runPromise(
			decodeStoryEvent({
				eventId: 'evt-apply',
				targetEntity: 'Arthur',
				coordinate: beat,
				type: 'STATUS_EFFECT',
				op: 'APPLY',
				name: 'Poisoned',
				durationScenes: 3,
			}),
		)
		const reversed = await Effect.runPromise(
			reduceWorld(initial, [clear, apply]),
		)
		const sorted = await Effect.runPromise(reduceWorld(initial, [apply, clear]))
		expect(reversed.characters.Arthur?.activeStatuses).toEqual([])
		expect(sorted.characters.Arthur?.activeStatuses).toEqual(
			reversed.characters.Arthur?.activeStatuses,
		)
	})
})

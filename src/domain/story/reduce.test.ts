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
			{
				name: 'Poisoned',
				durationScenes: 1,
				since: {
					branchId: 'main',
					chapterOrder: 1,
					sceneIndex: 1,
					beatIndex: 2,
					timestamp: 141,
				},
			},
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

	it('sets an absolute stat and leaves the other stats', async () => {
		const initial = await Effect.runPromise(
			decodeWorldState({
				characters: {
					Arthur: {
						...arthurWorld.characters.Arthur,
						stats: { HP: 100, MP: 5 },
					},
				},
			}),
		)
		const events = [
			await Effect.runPromise(
				decodeStoryEvent({
					eventId: 'evt-damage',
					targetEntity: 'Arthur',
					coordinate: coordinate(1, 170),
					type: 'STAT_CHANGE',
					deltas: { HP: -20 },
				}),
			),
			await Effect.runPromise(
				decodeStoryEvent({
					eventId: 'evt-override',
					targetEntity: 'Arthur',
					coordinate: coordinate(2, 171),
					type: 'OVERRIDE_SYNC',
					stats: { HP: 50 },
				}),
			),
		]
		const world = await Effect.runPromise(reduceWorld(initial, events))
		expect(world.characters.Arthur?.stats.HP).toBe(50)
		expect(world.characters.Arthur?.stats.MP).toBe(5)
	})

	it('sets a world flag and replaces it', async () => {
		const initial = await Effect.runPromise(decodeWorldState(arthurWorld))
		const events = [
			await Effect.runPromise(
				decodeStoryEvent({
					eventId: 'evt-flag',
					coordinate: coordinate(1, 180),
					type: 'FLAG_SET',
					flag: 'war',
					value: false,
				}),
			),
			await Effect.runPromise(
				decodeStoryEvent({
					eventId: 'evt-flag-again',
					coordinate: coordinate(2, 181),
					type: 'FLAG_SET',
					flag: 'war',
					value: true,
				}),
			),
		]
		const world = await Effect.runPromise(reduceWorld(initial, events))
		expect(world.globalFlags).toEqual({ war: true })
		expect(world.globalFlags.peace).toBeUndefined()
	})

	it('joins a faction once and leaves an absent faction unchanged', async () => {
		const initial = await Effect.runPromise(
			decodeWorldState({
				...arthurWorld,
				entities: {
					Round: {
						entityId: 'Round',
						name: 'Round Table',
						kind: 'faction',
					},
				},
			}),
		)
		const join = {
			eventId: 'evt-join',
			targetEntity: 'Arthur',
			coordinate: coordinate(1, 190),
			type: 'MEMBERSHIP' as const,
			op: 'JOIN' as const,
			factionId: 'Round',
		}
		const joined = await Effect.runPromise(
			reduceWorld(initial, [
				await Effect.runPromise(decodeStoryEvent(join)),
				await Effect.runPromise(
					decodeStoryEvent({ ...join, eventId: 'evt-join-again' }),
				),
			]),
		)
		expect(joined.characters.Arthur?.factions).toEqual(['Round'])
		const left = await Effect.runPromise(
			reduceWorld(initial, [
				await Effect.runPromise(
					decodeStoryEvent({
						eventId: 'evt-leave',
						targetEntity: 'Arthur',
						coordinate: coordinate(1, 191),
						type: 'MEMBERSHIP',
						op: 'LEAVE',
						factionId: 'Round',
					}),
				),
			]),
		)
		expect(left.characters.Arthur?.factions).toEqual([])
	})

	it('fails when a membership names a missing faction', async () => {
		const initial = await Effect.runPromise(decodeWorldState(arthurWorld))
		const result = await Effect.runPromise(
			Effect.either(
				reduceWorld(initial, [
					await Effect.runPromise(
						decodeStoryEvent({
							eventId: 'evt-join',
							targetEntity: 'Arthur',
							coordinate: coordinate(1, 192),
							type: 'MEMBERSHIP',
							op: 'JOIN',
							factionId: 'Round',
						}),
					),
				]),
			),
		)
		expect(result._tag).toBe('Left')
		if (result._tag !== 'Left') return
		expect(result.left._tag).toBe('UnknownEntity')
		if (result.left._tag !== 'UnknownEntity') return
		expect(result.left.targetEntity).toBe('Round')
	})

	it('replaces a character location and rejects a faction used as a region', async () => {
		const initial = await Effect.runPromise(
			decodeWorldState({
				...arthurWorld,
				entities: {
					Camelot: {
						entityId: 'Camelot',
						name: 'Camelot',
						kind: 'region',
					},
					Forest: {
						entityId: 'Forest',
						name: 'Forest',
						kind: 'region',
					},
					Round: {
						entityId: 'Round',
						name: 'Round Table',
						kind: 'faction',
					},
				},
			}),
		)
		const world = await Effect.runPromise(
			reduceWorld(initial, [
				await Effect.runPromise(
					decodeStoryEvent({
						eventId: 'evt-camelot',
						targetEntity: 'Arthur',
						coordinate: coordinate(1, 200),
						type: 'LOCATION_SET',
						regionId: 'Camelot',
					}),
				),
				await Effect.runPromise(
					decodeStoryEvent({
						eventId: 'evt-forest',
						targetEntity: 'Arthur',
						coordinate: coordinate(2, 201),
						type: 'LOCATION_SET',
						regionId: 'Forest',
					}),
				),
			]),
		)
		expect(world.characters.Arthur?.location).toBe('Forest')
		const rejected = await Effect.runPromise(
			Effect.either(
				reduceWorld(initial, [
					await Effect.runPromise(
						decodeStoryEvent({
							eventId: 'evt-round',
							targetEntity: 'Arthur',
							coordinate: coordinate(1, 202),
							type: 'LOCATION_SET',
							regionId: 'Round',
						}),
					),
				]),
			),
		)
		expect(rejected._tag).toBe('Left')
		if (rejected._tag !== 'Left') return
		expect(rejected.left._tag).toBe('UnknownEntity')
	})
})

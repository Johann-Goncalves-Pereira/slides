import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { projectSheet, storyStops } from './stops'

const coordinate = (
	branchId: string,
	chapterOrder: number,
	timestamp: number,
) => ({
	branchId,
	chapterOrder,
	sceneIndex: 0,
	beatIndex: 0,
	timestamp,
})

describe('storyStops', () => {
	it('orders one branch and drops duplicates, tombstones, and other branches', () => {
		const stops = storyStops(
			[
				{
					coordinate: coordinate('main', 2, 20),
					tombstoned: false,
				},
				{
					coordinate: coordinate('main', 1, 10),
					tombstoned: false,
				},
				{
					coordinate: coordinate('main', 1, 10),
					tombstoned: false,
				},
				{
					coordinate: coordinate('main', 3, 30),
					tombstoned: true,
				},
				{
					coordinate: coordinate('alt', 1, 10),
					tombstoned: false,
				},
			],
			'main',
		)
		expect(stops).toEqual([
			coordinate('main', 0, 0),
			coordinate('main', 1, 10),
			coordinate('main', 2, 20),
		])
	})

	it('stops on an event coordinate from the same branch', () => {
		const scene = {
			branchId: 'main',
			chapterOrder: 1,
			sceneIndex: 2,
			beatIndex: 1,
			timestamp: 10,
		}
		const stops = storyStops(
			[
				{
					coordinate: coordinate('main', 1, 10),
					tombstoned: false,
				},
			],
			'main',
			[
				{ coordinate: scene },
				{
					coordinate: { ...scene, branchId: 'alt', chapterOrder: 1 },
				},
			],
		)
		expect(stops).toEqual([
			coordinate('main', 0, 0),
			coordinate('main', 1, 10),
			scene,
		])
	})
})

const world = {
	characters: {
		Arthur: {
			characterId: 'Arthur',
			name: 'Arthur',
			stats: { HP: 80 },
			inventory: [{ itemId: 'excalibur', name: 'Excalibur', quantity: 1 }],
			affinities: [{ object: 'Merlin', axis: 'trust', score: -5 }],
			activeStatuses: [{ name: 'Blessed', durationScenes: 2 }],
			lastUpdatedCoordinate: coordinate('main', 1, 10),
		},
	},
}

describe('projectSheet', () => {
	it('exposes one character at the folded world', async () => {
		const sheet = await Effect.runPromise(projectSheet(world, 'Arthur'))
		expect(sheet).toEqual({
			characterId: 'Arthur',
			name: 'Arthur',
			stats: { HP: 80 },
			inventory: [{ itemId: 'excalibur', name: 'Excalibur', quantity: 1 }],
			activeStatuses: [{ name: 'Blessed', durationScenes: 2 }],
			affinities: [{ object: 'Merlin', axis: 'trust', score: -5 }],
			factions: [],
			flags: {},
		})
	})

	it('projects remaining scenes, factions, location, and flags', async () => {
		const since = coordinate('main', 1, 10)
		const query = {
			branchId: 'main',
			chapterOrder: 1,
			sceneIndex: 1,
			beatIndex: 0,
			timestamp: 10,
		}
		const sheet = await Effect.runPromise(
			projectSheet(
				{
					globalFlags: { war: true },
					entities: {
						Round: {
							entityId: 'Round',
							name: 'Round Table',
							kind: 'faction',
						},
						Camelot: {
							entityId: 'Camelot',
							name: 'Camelot',
							kind: 'region',
						},
					},
					characters: {
						Arthur: {
							...world.characters.Arthur,
							factions: ['Round'],
							location: 'Camelot',
							activeStatuses: [{ name: 'Poisoned', durationScenes: 2, since }],
						},
					},
				},
				'Arthur',
				{ at: query, scenes: [query] },
			),
		)
		expect(sheet.factions).toEqual(['Round'])
		expect(sheet.location).toBe('Camelot')
		expect(sheet.flags).toEqual({ war: true })
		expect(sheet.activeStatuses).toEqual([
			{ name: 'Poisoned', durationScenes: 1, since },
		])
	})

	it('fails when the character is absent', async () => {
		const result = await Effect.runPromise(
			Effect.either(projectSheet(world, 'Merlin')),
		)
		expect(result._tag).toBe('Left')
	})
})

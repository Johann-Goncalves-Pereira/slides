import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import {
	affinityTone,
	decodeHudGraph,
	layoutGraph,
	projectGraph,
} from './graph'

const world = {
	characters: {
		Arthur: {
			characterId: 'Arthur',
			name: 'Arthur',
			stats: { HP: 80 },
			inventory: [{ itemId: 'excalibur', name: 'Excalibur', quantity: 1 }],
			affinities: [{ object: 'Merlin', axis: 'trust', score: -5 }],
			activeStatuses: [],
			lastUpdatedCoordinate: {
				branchId: 'main',
				chapterOrder: 1,
				sceneIndex: 0,
				beatIndex: 0,
				timestamp: 10,
			},
		},
	},
}

describe('projectGraph', () => {
	it('draws affinity and held items without storing tone on a node', async () => {
		const graph = await Effect.runPromise(projectGraph(world))
		expect(graph.edges).toContainEqual({
			id: 'affinity:Arthur:Merlin:trust',
			source: 'character:Arthur',
			target: 'object:Merlin',
			kind: 'affinity',
			axis: 'trust',
			score: -5,
		})
		expect(graph.edges).toContainEqual({
			id: 'holds:Arthur:excalibur',
			source: 'character:Arthur',
			target: 'item:excalibur',
			kind: 'holds',
			quantity: 1,
		})
		const decoded = await Effect.runPromise(decodeHudGraph(graph))
		expect(decoded.nodes.map(node => node.id)).toEqual([
			'character:Arthur',
			'item:excalibur',
			'object:Merlin',
		])
		for (const node of graph.nodes) {
			expect(Object.keys(node).sort()).toEqual(['id', 'kind', 'label'])
		}
	})

	it('types a registry match and leaves an unreferenced spell off the graph', async () => {
		const graph = await Effect.runPromise(
			projectGraph({
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
					Excalibur: {
						entityId: 'Excalibur',
						name: 'Excalibur',
						kind: 'artifact',
					},
					Fire: { entityId: 'Fire', name: 'Fireball', kind: 'spell' },
					Prophecy: {
						entityId: 'Prophecy',
						name: 'The Prophecy',
						kind: 'lore',
					},
				},
				characters: {
					Arthur: {
						...world.characters.Arthur,
						inventory: [
							{ itemId: 'Excalibur', name: 'Excalibur', quantity: 1 },
							{ itemId: 'potion', name: 'Potion', quantity: 1 },
						],
						affinities: [{ object: 'Fire', axis: 'fear', score: 60 }],
						factions: ['Round'],
						location: 'Camelot',
					},
				},
			}),
		)
		expect(graph.nodes.map(node => node.kind).sort()).toEqual([
			'artifact',
			'character',
			'faction',
			'item',
			'region',
			'spell',
		])
		expect(graph.edges).toContainEqual({
			id: 'member:Arthur:Round',
			source: 'character:Arthur',
			target: 'faction:Round',
			kind: 'member',
		})
		expect(graph.edges).toContainEqual({
			id: 'present:Arthur:Camelot',
			source: 'character:Arthur',
			target: 'region:Camelot',
			kind: 'present',
		})
		expect(graph.edges).toContainEqual({
			id: 'holds:Arthur:Excalibur',
			source: 'character:Arthur',
			target: 'artifact:Excalibur',
			kind: 'holds',
			quantity: 1,
		})
		expect(graph.nodes.some(node => node.kind === 'lore')).toBe(false)
	})
})

describe('affinityTone', () => {
	it('reads only the score', () => {
		expect(affinityTone(-5)).toEqual({ color: '#A855F7', motion: 'recede' })
		expect(affinityTone(5)).toEqual({ color: '#00E5FF', motion: 'approach' })
		expect(affinityTone(0)).toEqual({ color: '#D4AF37', motion: 'still' })
		expect(affinityTone(50)).toEqual({ color: '#22C55E', motion: 'approach' })
		expect(affinityTone(-50)).toEqual({ color: '#EF4444', motion: 'recede' })
		expect(affinityTone(-5)).toEqual(affinityTone(-5))
	})
})

describe('layoutGraph', () => {
	it('places the same graph in the same positions', async () => {
		const graph = await Effect.runPromise(projectGraph(world))
		const before = graph.nodes.map(node => ({ ...node }))
		const first = layoutGraph(graph)
		const second = layoutGraph(graph)
		expect(second).toEqual(first)
		expect(first).toEqual([
			{ id: 'character:Arthur', x: 0, y: 0 },
			{ id: 'item:excalibur', x: 560, y: 0 },
			{ id: 'object:Merlin', x: 560, y: 120 },
		])
		expect(graph.nodes).toEqual(before)
	})

	it('runs the same layout from the function source', async () => {
		const graph = await Effect.runPromise(projectGraph(world))
		const revived: unknown = Function(`return (${layoutGraph.toString()})`)()
		if (typeof revived !== 'function') {
			throw new Error('layout source did not revive')
		}
		expect(revived(graph)).toEqual(layoutGraph(graph))
	})
})

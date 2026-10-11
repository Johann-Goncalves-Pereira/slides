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
})

describe('affinityTone', () => {
	it('reads only the score', () => {
		expect(affinityTone(-5)).toEqual({ color: '#A855F7', motion: 'recede' })
		expect(affinityTone(5)).toEqual({ color: '#00E5FF', motion: 'approach' })
		expect(affinityTone(0)).toEqual({ color: '#D4AF37', motion: 'still' })
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
			{ id: 'character:Arthur', x: 200, y: 0 },
			{ id: 'item:excalibur', x: -100, y: 173 },
			{ id: 'object:Merlin', x: -100, y: -173 },
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

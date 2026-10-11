import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { projectMatrix } from './matrix'

const coordinate = {
	branchId: 'main',
	chapterOrder: 1,
	sceneIndex: 0,
	beatIndex: 0,
	timestamp: 1,
}

const character = (
	characterId: string,
	affinities: readonly {
		readonly object: string
		readonly axis: string
		readonly score: number
	}[],
) => ({
	characterId,
	name: characterId,
	stats: {},
	inventory: [],
	affinities,
	activeStatuses: [],
	lastUpdatedCoordinate: coordinate,
})

describe('projectMatrix', () => {
	it('sorts affinity rows and rejects an empty or unknown world', async () => {
		const rows = await Effect.runPromise(
			projectMatrix({
				characters: {
					Merlin: character('Merlin', [
						{ object: 'Arthur', axis: 'trust', score: -5 },
					]),
					Arthur: character('Arthur', [
						{ object: 'Merlin', axis: 'respect', score: 2 },
						{ object: 'Merlin', axis: 'trust', score: 15 },
					]),
				},
			}),
		)
		expect(rows).toEqual([
			{ subject: 'Arthur', object: 'Merlin', axis: 'respect', score: 2 },
			{ subject: 'Arthur', object: 'Merlin', axis: 'trust', score: 15 },
			{ subject: 'Merlin', object: 'Arthur', axis: 'trust', score: -5 },
		])
		const empty = await Effect.runPromise(
			Effect.either(projectMatrix({ characters: {} })),
		)
		const unknown = await Effect.runPromise(Effect.either(projectMatrix({})))
		expect(empty._tag).toBe('Left')
		expect(empty._tag === 'Left' && empty.left._tag).toBe('EmptyMatrix')
		expect(unknown._tag).toBe('Left')
		expect(unknown._tag === 'Left' && unknown.left._tag).not.toBe('EmptyMatrix')
	})
})

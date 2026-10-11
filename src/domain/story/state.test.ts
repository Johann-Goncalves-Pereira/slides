import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { decodeWorldState } from './state'

const arthur = {
	characterId: 'Arthur',
	name: 'Arthur',
	stats: { HP: 100 },
	inventory: [],
	affinities: [],
	activeStatuses: [],
	lastUpdatedCoordinate: {
		branchId: 'main',
		chapterOrder: 0,
		sceneIndex: 0,
		beatIndex: 0,
		timestamp: 0,
	},
}

describe('decodeWorldState', () => {
	it('rejects a character whose id does not match its key', async () => {
		const result = await Effect.runPromise(
			Effect.either(
				decodeWorldState({
					characters: {
						Arthur: { ...arthur, characterId: 'Merlin' },
					},
				}),
			),
		)
		expect(result._tag).toBe('Left')
	})
})

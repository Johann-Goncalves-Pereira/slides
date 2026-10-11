import { describe, expect, it } from 'vitest'
import { compareCoordinates } from './coordinate'

const earlier = {
	branchId: 'alt',
	chapterOrder: 2,
	sceneIndex: 3,
	beatIndex: 4,
	timestamp: 200,
}

describe('compareCoordinates', () => {
	it('orders by branch, then chapter, scene, beat, and timestamp', () => {
		const laterBranch = { ...earlier, branchId: 'main' }
		expect(compareCoordinates(earlier, laterBranch)).toBe(-1)
		expect(compareCoordinates(laterBranch, earlier)).toBe(1)

		expect(compareCoordinates(earlier, { ...earlier, chapterOrder: 3 })).toBe(
			-1,
		)
		expect(compareCoordinates(earlier, { ...earlier, sceneIndex: 4 })).toBe(-1)
		expect(compareCoordinates(earlier, { ...earlier, beatIndex: 5 })).toBe(-1)
		expect(compareCoordinates(earlier, { ...earlier, timestamp: 201 })).toBe(-1)
		expect(compareCoordinates(earlier, { ...earlier })).toBe(0)
	})
})

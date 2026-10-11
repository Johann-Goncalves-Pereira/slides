import { describe, expect, it } from 'vitest'
import type { StoryCoordinate } from './coordinate'
import { remainingStatuses } from './status'

const at = (
	chapterOrder: number,
	sceneIndex: number,
	beatIndex = 0,
): StoryCoordinate => ({
	branchId: 'main',
	chapterOrder,
	sceneIndex,
	beatIndex,
	timestamp: 10,
})

describe('remainingStatuses', () => {
	it('counts each later scene once, including the query scene', () => {
		const statuses = remainingStatuses(
			[
				{
					name: 'Poisoned',
					durationScenes: 3,
					since: at(1, 0),
				},
			],
			at(1, 2, 5),
			[at(1, 1, 0), at(1, 1, 1), at(1, 2, 0)],
		)
		expect(statuses).toEqual([
			{
				name: 'Poisoned',
				durationScenes: 1,
				since: at(1, 0),
			},
		])
	})

	it('drops a status whose remaining scenes reach zero', () => {
		const statuses = remainingStatuses(
			[{ name: 'Poisoned', durationScenes: 1, since: at(1, 0) }],
			at(1, 1),
			[],
		)
		expect(statuses).toEqual([])
	})

	it('leaves a status without a duration or a since coordinate', () => {
		const stored = [
			{ name: 'Blessed' },
			{ name: 'Poisoned', durationScenes: 3 },
		]
		expect(remainingStatuses(stored, at(4, 2), [at(2, 1), at(3, 0)])).toEqual(
			stored,
		)
	})

	it('ignores scenes on another branch', () => {
		const statuses = remainingStatuses(
			[{ name: 'Poisoned', durationScenes: 2, since: at(1, 0) }],
			at(1, 0, 4),
			[{ ...at(1, 1), branchId: 'alt' }],
		)
		expect(statuses).toEqual([
			{ name: 'Poisoned', durationScenes: 2, since: at(1, 0) },
		])
	})
})

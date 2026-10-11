import { Schema } from 'effect'

export const StoryCoordinate = Schema.Struct({
	branchId: Schema.optionalWith(Schema.NonEmptyString, {
		default: () => 'main',
	}),
	chapterOrder: Schema.NonNegativeInt,
	sceneIndex: Schema.NonNegativeInt,
	beatIndex: Schema.NonNegativeInt,
	timestamp: Schema.NonNegativeInt,
})

export type StoryCoordinate = typeof StoryCoordinate.Type

export const decodeStoryCoordinate = Schema.decodeUnknown(StoryCoordinate)

const order = (left: number | string, right: number | string): -1 | 0 | 1 => {
	if (left < right) return -1
	if (left > right) return 1
	return 0
}

export const compareCoordinates = (
	left: StoryCoordinate,
	right: StoryCoordinate,
): -1 | 0 | 1 => {
	const branch = order(left.branchId, right.branchId)
	if (branch !== 0) return branch
	const chapter = order(left.chapterOrder, right.chapterOrder)
	if (chapter !== 0) return chapter
	const scene = order(left.sceneIndex, right.sceneIndex)
	if (scene !== 0) return scene
	const beat = order(left.beatIndex, right.beatIndex)
	if (beat !== 0) return beat
	return order(left.timestamp, right.timestamp)
}

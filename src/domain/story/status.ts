import type { StoryCoordinate } from './coordinate'
import type { ActiveStatus } from './state'

const sceneKey = (coordinate: StoryCoordinate): string =>
	`${coordinate.chapterOrder}:${coordinate.sceneIndex}`

const laterScene = (scene: StoryCoordinate, since: StoryCoordinate): boolean =>
	scene.chapterOrder > since.chapterOrder ||
	(scene.chapterOrder === since.chapterOrder &&
		scene.sceneIndex > since.sceneIndex)

const sceneAtOrBefore = (
	scene: StoryCoordinate,
	query: StoryCoordinate,
): boolean =>
	scene.chapterOrder < query.chapterOrder ||
	(scene.chapterOrder === query.chapterOrder &&
		scene.sceneIndex <= query.sceneIndex)

const crossed = (
	status: ActiveStatus & { readonly since: StoryCoordinate },
	at: StoryCoordinate,
	scenes: readonly StoryCoordinate[],
): number => {
	const keys = new Set<string>()
	for (const scene of scenes) {
		if (scene.branchId !== at.branchId) continue
		if (!laterScene(scene, status.since)) continue
		if (!sceneAtOrBefore(scene, at)) continue
		keys.add(sceneKey(scene))
	}
	if (laterScene(at, status.since)) keys.add(sceneKey(at))
	return keys.size
}

export const remainingStatuses = (
	statuses: readonly ActiveStatus[],
	at: StoryCoordinate,
	scenes: readonly StoryCoordinate[],
): readonly ActiveStatus[] =>
	statuses.flatMap(status => {
		if (status.durationScenes === undefined || status.since === undefined) {
			return [status]
		}
		const since = status.since
		const durationScenes =
			status.durationScenes - crossed({ ...status, since }, at, scenes)
		if (durationScenes <= 0) return []
		return [{ ...status, durationScenes }]
	})

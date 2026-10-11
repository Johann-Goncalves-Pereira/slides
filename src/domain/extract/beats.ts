import type { StoryCoordinate } from '../story/coordinate'
import type { VaultRoots } from '../vault/roots'

export type WikilinkEdit = {
	readonly kind: 'added' | 'removed'
	readonly target: string
}

export type BeatSlice = {
	readonly text: string
	readonly coordinate: StoryCoordinate
}

const linkPattern = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g

const watched = (target: string, roots: VaultRoots): boolean =>
	target === roots.personagens ||
	target.startsWith(`${roots.personagens}/`) ||
	target === roots.mundo ||
	target.startsWith(`${roots.mundo}/`)

const counts = (markdown: string, roots: VaultRoots): Map<string, number> => {
	const found = new Map<string, number>()
	for (const match of markdown.matchAll(linkPattern)) {
		const target = match[1]?.trim()
		if (target === undefined || !watched(target, roots)) continue
		found.set(target, (found.get(target) ?? 0) + 1)
	}
	return found
}

export const wikilinkEdits = (
	before: string,
	after: string,
	roots: VaultRoots,
): readonly WikilinkEdit[] => {
	const previous = counts(before, roots)
	const next = counts(after, roots)
	const targets = [...new Set([...previous.keys(), ...next.keys()])].sort()
	const edits: WikilinkEdit[] = []
	for (const target of targets) {
		const delta = (next.get(target) ?? 0) - (previous.get(target) ?? 0)
		const kind = delta > 0 ? 'added' : 'removed'
		for (let count = 0; count < Math.abs(delta); count += 1) {
			edits.push({ kind, target })
		}
	}
	return edits.sort((left, right) => {
		if (left.kind === right.kind) return left.target < right.target ? -1 : 1
		return left.kind === 'added' ? -1 : 1
	})
}

export type ChapterClock = {
	readonly chapterOrder: number
	readonly timestamp: number
	readonly branchId: string
}

const isSceneBreak = (line: string): boolean => {
	const normalized = line.trim().replace(/\s+/g, ' ')
	return normalized === '***' || normalized === '* * *'
}

const isBeatBreak = (line: string): boolean => {
	const trimmed = line.trim()
	return trimmed === '---' || /^<!--\s*beat\b/.test(trimmed)
}

export const splitBeats = (
	markdown: string,
	chapter: ChapterClock,
): readonly BeatSlice[] => {
	const slices: BeatSlice[] = []
	let sceneIndex = 0
	let beatIndex = 0
	let buffer: string[] = []
	const flush = (): void => {
		const text = buffer.join('\n').trim()
		buffer = []
		if (text.length === 0) return
		slices.push({
			text,
			coordinate: {
				branchId: chapter.branchId,
				chapterOrder: chapter.chapterOrder,
				sceneIndex,
				beatIndex,
				timestamp: chapter.timestamp,
			},
		})
	}
	for (const line of markdown.split('\n')) {
		if (isSceneBreak(line)) {
			flush()
			sceneIndex += 1
			beatIndex = 0
			continue
		}
		if (isBeatBreak(line)) {
			flush()
			beatIndex += 1
			continue
		}
		buffer.push(line)
	}
	flush()
	return slices
}

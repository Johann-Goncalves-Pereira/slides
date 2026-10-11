import { type Context, Effect, type ParseResult } from 'effect'
import { compareCoordinates, type StoryCoordinate } from '../story/coordinate'
import type { StoryEvent } from '../story/event'
import { type Ledger, makeMemoryLedger } from '../story/ledger'
import type { ReduceError } from '../story/reduce'
import { buildSnapshots, manuscriptSnapshotPolicy } from '../story/snapshot'
import { decodeWorldState, type WorldEntity } from '../story/state'
import {
	DuplicateCharacter,
	DuplicateEntity,
	DuplicateNoteId,
	MissingNoteId,
	SidecarMismatch,
} from './errors'
import {
	type ChapterNote,
	type CharacterNote,
	decodeChapterNote,
	decodeCharacterNote,
	decodeEventSidecar,
	decodeMundoEntity,
	type EventSidecar,
	mundoHasKind,
	readNoteId,
} from './frontmatter'

const origin: StoryCoordinate = {
	branchId: 'main',
	chapterOrder: 0,
	sceneIndex: 0,
	beatIndex: 0,
	timestamp: 0,
}

export type VaultFile = {
	readonly path: string
	readonly kind: 'character' | 'chapter' | 'mundo' | 'assets'
	readonly frontmatter: unknown
	readonly sidecar?: unknown
}

export type PathChange =
	| { readonly type: 'modify'; readonly file: VaultFile }
	| { readonly type: 'rename'; readonly from: string; readonly to: string }
	| { readonly type: 'delete'; readonly path: string }

export type IndexedCharacter = {
	readonly kind: 'character'
	readonly path: string
	readonly noteId: string
	readonly name: string
	readonly characterId: string
	readonly stats: CharacterNote['stats']
}

export type IndexedChapter = {
	readonly kind: 'chapter'
	readonly path: string
	readonly noteId: string
	readonly act: string
	readonly coordinate: StoryCoordinate
	readonly overrides: ChapterNote['overrides']
	readonly sidecar: EventSidecar
}

export type IndexedListing = {
	readonly kind: 'mundo' | 'assets'
	readonly path: string
	readonly noteId: string
}

export type IndexedEntity = {
	readonly kind: 'entity'
	readonly path: string
	readonly noteId: string
	readonly name: string
	readonly entityId: string
	readonly entityKind: WorldEntity['kind']
}

export type IndexedNote =
	| IndexedCharacter
	| IndexedChapter
	| IndexedListing
	| IndexedEntity

export type VaultIndex = {
	readonly byId: ReadonlyMap<string, IndexedNote>
	readonly byPath: ReadonlyMap<string, string>
	readonly skipped: readonly MissingNoteId[]
}

export type IndexError =
	| ParseResult.ParseError
	| DuplicateNoteId
	| SidecarMismatch
	| DuplicateCharacter
	| DuplicateEntity

export const emptyVaultIndex = (): VaultIndex => ({
	byId: new Map(),
	byPath: new Map(),
	skipped: [],
})

export const sidecarPath = (notePath: string): string => {
	const dot = notePath.lastIndexOf('.')
	const stem = dot === -1 ? notePath : notePath.slice(0, dot)
	return `${stem}.events.json`
}

const removePath = (index: VaultIndex, path: string): VaultIndex => {
	const noteId = index.byPath.get(path)
	if (noteId === undefined) return index
	const byPath = new Map(index.byPath)
	byPath.delete(path)
	const byId = new Map(index.byId)
	const note = byId.get(noteId)
	if (note?.path === path) byId.delete(noteId)
	return { byId, byPath, skipped: index.skipped }
}

const insert = (index: VaultIndex, note: IndexedNote): VaultIndex => {
	const byId = new Map(index.byId)
	byId.set(note.noteId, note)
	const byPath = new Map(index.byPath)
	byPath.set(note.path, note.noteId)
	return {
		byId,
		byPath,
		skipped: index.skipped.filter(skip => skip.path !== note.path),
	}
}

const forgetPath = (index: VaultIndex, path: string): VaultIndex => {
	const removed = removePath(index, path)
	if (removed.skipped.some(skip => skip.path === path)) return removed
	return {
		...removed,
		skipped: [...removed.skipped, new MissingNoteId({ path })],
	}
}

const chapterFrom = (
	file: VaultFile,
	note: ChapterNote,
): Effect.Effect<IndexedChapter, ParseResult.ParseError | SidecarMismatch> =>
	Effect.gen(function* () {
		const sidecar =
			file.sidecar === undefined
				? { noteId: note.noteId, tombstoned: false, events: [] }
				: yield* decodeEventSidecar(file.sidecar)
		if (sidecar.noteId !== note.noteId) {
			return yield* new SidecarMismatch({
				path: file.path,
				noteId: note.noteId,
				sidecarNoteId: sidecar.noteId,
			})
		}
		return {
			kind: 'chapter',
			path: file.path,
			noteId: note.noteId,
			act: note.act,
			coordinate: note.coordinate,
			overrides: note.overrides,
			sidecar,
		}
	})

const decodeIndexed = (
	file: VaultFile,
	noteId: string,
): Effect.Effect<IndexedNote, ParseResult.ParseError | SidecarMismatch> => {
	if (file.kind === 'character') {
		return decodeCharacterNote(file.frontmatter).pipe(
			Effect.map(note => ({
				kind: 'character' as const,
				path: file.path,
				noteId: note.noteId,
				name: note.name,
				characterId: note.characterId,
				stats: note.stats,
			})),
		)
	}
	if (file.kind === 'chapter') {
		return decodeChapterNote(file.frontmatter).pipe(
			Effect.flatMap(note => chapterFrom(file, note)),
		)
	}
	if (file.kind === 'mundo') {
		return Effect.gen(function* () {
			const typed = yield* mundoHasKind(file.frontmatter)
			if (!typed) {
				return {
					kind: 'mundo' as const,
					path: file.path,
					noteId,
				}
			}
			const note = yield* decodeMundoEntity(file.frontmatter)
			return {
				kind: 'entity' as const,
				path: file.path,
				noteId: note.noteId,
				name: note.name,
				entityId: note.entityId,
				entityKind: note.kind,
			}
		})
	}
	return Effect.succeed({
		kind: file.kind,
		path: file.path,
		noteId,
	})
}

const applyModify = (
	index: VaultIndex,
	file: VaultFile,
): Effect.Effect<VaultIndex, IndexError> =>
	Effect.gen(function* () {
		const noteId = yield* readNoteId(file.frontmatter)
		if (noteId === undefined) return forgetPath(index, file.path)
		const note = yield* decodeIndexed(file, noteId)
		const occupant = index.byId.get(note.noteId)
		if (occupant !== undefined && occupant.path !== file.path) {
			return yield* new DuplicateNoteId({
				noteId: note.noteId,
				path: file.path,
			})
		}
		return insert(removePath(index, file.path), note)
	})

const applyRename = (
	index: VaultIndex,
	from: string,
	to: string,
): VaultIndex => {
	const noteId = index.byPath.get(from)
	if (noteId === undefined) return index
	const note = index.byId.get(noteId)
	if (note === undefined) return index
	const byPath = new Map(index.byPath)
	byPath.delete(from)
	byPath.set(to, noteId)
	const byId = new Map(index.byId)
	byId.set(noteId, { ...note, path: to })
	return { byId, byPath, skipped: index.skipped }
}

const applyDelete = (index: VaultIndex, path: string): VaultIndex => {
	const noteId = index.byPath.get(path)
	if (noteId === undefined) return index
	const note = index.byId.get(noteId)
	if (note === undefined) return index
	if (note.kind !== 'chapter') return removePath(index, path)
	const byId = new Map(index.byId)
	byId.set(noteId, {
		...note,
		sidecar: { ...note.sidecar, tombstoned: true },
	})
	return { byId, byPath: index.byPath, skipped: index.skipped }
}

export const applyPathChange = (
	index: VaultIndex,
	change: PathChange,
): Effect.Effect<VaultIndex, IndexError> => {
	switch (change.type) {
		case 'modify':
			return applyModify(index, change.file)
		case 'rename':
			return Effect.succeed(applyRename(index, change.from, change.to))
		case 'delete':
			return Effect.succeed(applyDelete(index, change.path))
	}
}

export const indexNotes = (
	files: readonly VaultFile[],
): Effect.Effect<VaultIndex, IndexError> =>
	Effect.reduce(files, emptyVaultIndex(), (index, file) =>
		applyPathChange(index, { type: 'modify', file }),
	)

export const ledgerFromIndex = (
	index: VaultIndex,
): Effect.Effect<
	Context.Tag.Service<typeof Ledger>,
	IndexError | ReduceError
> =>
	Effect.gen(function* () {
		const characters: {
			[characterId: string]: {
				characterId: string
				name: string
				stats: CharacterNote['stats']
				inventory: []
				affinities: []
				activeStatuses: []
				lastUpdatedCoordinate: StoryCoordinate
			}
		} = {}
		const entities: {
			[entityId: string]: {
				entityId: string
				name: string
				kind: WorldEntity['kind']
			}
		} = {}
		const events: StoryEvent[] = []
		for (const note of index.byId.values()) {
			if (note.kind === 'character') {
				if (characters[note.characterId] !== undefined) {
					return yield* new DuplicateCharacter({
						characterId: note.characterId,
					})
				}
				characters[note.characterId] = {
					characterId: note.characterId,
					name: note.name,
					stats: note.stats,
					inventory: [],
					affinities: [],
					activeStatuses: [],
					lastUpdatedCoordinate: origin,
				}
			}
			if (note.kind === 'entity') {
				if (entities[note.entityId] !== undefined) {
					return yield* new DuplicateEntity({ entityId: note.entityId })
				}
				entities[note.entityId] = {
					entityId: note.entityId,
					name: note.name,
					kind: note.entityKind,
				}
			}
			if (note.kind === 'chapter' && !note.sidecar.tombstoned) {
				events.push(...note.sidecar.events)
			}
		}
		const initialState = yield* decodeWorldState({ characters, entities })
		const snapshots = yield* buildSnapshots(
			initialState,
			events,
			manuscriptSnapshotPolicy,
		)
		return makeMemoryLedger({ initialState, events, snapshots })
	})

export const eventCoordinates = (
	index: VaultIndex,
	at: StoryCoordinate,
): readonly StoryCoordinate[] => {
	const scenes: StoryCoordinate[] = []
	for (const note of index.byId.values()) {
		if (note.kind !== 'chapter' || note.sidecar.tombstoned) continue
		for (const event of note.sidecar.events) {
			if (event.coordinate.branchId !== at.branchId) continue
			if (compareCoordinates(event.coordinate, at) > 0) continue
			scenes.push(event.coordinate)
		}
	}
	return scenes
}

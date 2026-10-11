import { Data, Effect, type ParseResult } from 'effect'
import {
	type CharacterSheet,
	projectSheet,
	type UnknownCharacter,
} from '../hud/stops'
import { compareCoordinates, type StoryCoordinate } from '../story/coordinate'
import type { RehydrationError } from '../story/errors'
import type { StoryEvent } from '../story/event'
import { Ledger } from '../story/ledger'
import type { ReduceError } from '../story/reduce'
import { rehydrateAt } from '../story/rehydrate'
import {
	eventCoordinates,
	type IndexError,
	type IndexedChapter,
	ledgerFromIndex,
	type VaultIndex,
} from '../vault/index'
import { type EmptyMatrix, type MatrixRow, projectMatrix } from './matrix'
import {
	decodeCharacterSheetSource,
	decodeRelationshipMatrixSource,
	decodeRpgEventSource,
} from './source'
import { MissingEvent } from './without-event'

export class NotAChapter extends Data.TaggedError('NotAChapter')<{
	readonly path: string
}> {}

export type ReadError =
	| NotAChapter
	| MissingEvent
	| EmptyMatrix
	| UnknownCharacter
	| RehydrationError
	| IndexError
	| ReduceError
	| ParseResult.ParseError

const requireChapter = (
	index: VaultIndex,
	path: string,
): Effect.Effect<IndexedChapter, NotAChapter> =>
	Effect.gen(function* () {
		const noteId = index.byPath.get(path)
		const note = noteId === undefined ? undefined : index.byId.get(noteId)
		if (note?.kind !== 'chapter' || note.sidecar.tombstoned) {
			return yield* new NotAChapter({ path })
		}
		return note
	})

const worldAt = (index: VaultIndex, coordinate: StoryCoordinate) =>
	Effect.gen(function* () {
		const ledger = yield* ledgerFromIndex(index)
		return yield* rehydrateAt(coordinate).pipe(
			Effect.provideService(Ledger, ledger),
		)
	})

const visibleEvent = (
	index: VaultIndex,
	chapter: IndexedChapter,
	eventId: string,
): StoryEvent | undefined => {
	for (const note of index.byId.values()) {
		if (note.kind !== 'chapter' || note.sidecar.tombstoned) continue
		for (const event of note.sidecar.events) {
			if (event.eventId !== eventId) continue
			if (event.coordinate.branchId !== chapter.coordinate.branchId) continue
			if (compareCoordinates(event.coordinate, chapter.coordinate) > 0) {
				continue
			}
			return event
		}
	}
	return undefined
}

export const readCharacterSheet = (
	index: VaultIndex,
	path: string,
	source: string,
): Effect.Effect<CharacterSheet, ReadError> =>
	Effect.gen(function* () {
		const characterId = yield* decodeCharacterSheetSource(source)
		const chapter = yield* requireChapter(index, path)
		const world = yield* worldAt(index, chapter.coordinate)
		return yield* projectSheet(world, characterId, {
			at: chapter.coordinate,
			scenes: eventCoordinates(index, chapter.coordinate),
		})
	})

export const readRelationshipMatrix = (
	index: VaultIndex,
	path: string,
	source: string,
): Effect.Effect<readonly MatrixRow[], ReadError> =>
	Effect.gen(function* () {
		yield* decodeRelationshipMatrixSource(source)
		const chapter = yield* requireChapter(index, path)
		const world = yield* worldAt(index, chapter.coordinate)
		return yield* projectMatrix(world)
	})

export const readRpgEvent = (
	index: VaultIndex,
	path: string,
	source: string,
): Effect.Effect<StoryEvent, ReadError> =>
	Effect.gen(function* () {
		const eventId = yield* decodeRpgEventSource(source)
		const chapter = yield* requireChapter(index, path)
		yield* worldAt(index, chapter.coordinate)
		const event = visibleEvent(index, chapter, eventId)
		if (event === undefined) return yield* new MissingEvent({ eventId })
		return event
	})

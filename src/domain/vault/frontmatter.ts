import { Effect, type ParseResult, Schema } from 'effect'
import type { StoryCoordinate } from '../story/coordinate'
import { StoryEvent } from '../story/event'

const FiniteStats = Schema.Record({
	key: Schema.NonEmptyString,
	value: Schema.Finite,
})

const NonEmptyStats = FiniteStats.pipe(
	Schema.filter(
		stats => Object.keys(stats).length > 0 || 'stat map must be non-empty',
	),
)

const OverrideMap = Schema.Record({
	key: Schema.NonEmptyString,
	value: NonEmptyStats,
}).pipe(
	Schema.filter(
		overrides =>
			Object.keys(overrides).length > 0 || 'overrides must be non-empty',
	),
)

const CharacterNoteInput = Schema.Struct({
	noteId: Schema.NonEmptyString,
	name: Schema.NonEmptyString,
	characterId: Schema.optional(Schema.NonEmptyString),
	stats: Schema.optionalWith(FiniteStats, { default: () => ({}) }),
})

export type CharacterNote = {
	readonly noteId: string
	readonly name: string
	readonly characterId: string
	readonly stats: { readonly [stat: string]: number }
}

export const decodeCharacterNote = (
	input: unknown,
): Effect.Effect<CharacterNote, ParseResult.ParseError> =>
	Effect.gen(function* () {
		const note = yield* Schema.decodeUnknown(CharacterNoteInput)(input)
		return {
			noteId: note.noteId,
			name: note.name,
			characterId: note.characterId ?? note.name,
			stats: note.stats,
		}
	})

const ChapterNoteInput = Schema.Struct({
	noteId: Schema.NonEmptyString,
	order: Schema.NonNegativeInt,
	timestamp: Schema.NonNegativeInt,
	act: Schema.NonEmptyString,
	branchId: Schema.optionalWith(Schema.NonEmptyString, {
		default: () => 'main',
	}),
	overrides: Schema.optional(OverrideMap),
})

export type ChapterNote = {
	readonly noteId: string
	readonly act: string
	readonly coordinate: StoryCoordinate
	readonly overrides: {
		readonly [characterId: string]: { readonly [stat: string]: number }
	}
}

export const decodeChapterNote = (
	input: unknown,
): Effect.Effect<ChapterNote, ParseResult.ParseError> =>
	Effect.gen(function* () {
		const note = yield* Schema.decodeUnknown(ChapterNoteInput)(input)
		return {
			noteId: note.noteId,
			act: note.act,
			coordinate: {
				branchId: note.branchId,
				chapterOrder: note.order,
				sceneIndex: 0,
				beatIndex: 0,
				timestamp: note.timestamp,
			},
			overrides: note.overrides ?? {},
		}
	})

const EventSidecarInput = Schema.Struct({
	noteId: Schema.NonEmptyString,
	tombstoned: Schema.optionalWith(Schema.Boolean, { default: () => false }),
	events: Schema.Array(StoryEvent),
})

export type EventSidecar = typeof EventSidecarInput.Type

export const decodeEventSidecar = Schema.decodeUnknown(EventSidecarInput)

const NoteIdProbe = Schema.Struct({
	noteId: Schema.optional(Schema.NonEmptyString),
})

const EntityKind = Schema.Literal(
	'faction',
	'artifact',
	'region',
	'spell',
	'lore',
)

const MundoKindProbe = Schema.Struct({
	kind: Schema.optional(EntityKind),
})

const MundoEntityInput = Schema.Struct({
	noteId: Schema.NonEmptyString,
	name: Schema.NonEmptyString,
	entityId: Schema.optional(Schema.NonEmptyString),
	kind: EntityKind,
})

export type MundoEntityNote = {
	readonly noteId: string
	readonly name: string
	readonly entityId: string
	readonly kind: typeof EntityKind.Type
}

export const decodeMundoEntity = (
	input: unknown,
): Effect.Effect<MundoEntityNote, ParseResult.ParseError> =>
	Effect.gen(function* () {
		const note = yield* Schema.decodeUnknown(MundoEntityInput)(input)
		return {
			noteId: note.noteId,
			name: note.name,
			entityId: note.entityId ?? note.name,
			kind: note.kind,
		}
	})

export const mundoHasKind = (
	frontmatter: unknown,
): Effect.Effect<boolean, ParseResult.ParseError> =>
	Effect.map(
		Schema.decodeUnknown(MundoKindProbe)(frontmatter),
		probe => probe.kind !== undefined,
	)

export const readNoteId = (
	frontmatter: unknown,
): Effect.Effect<string | undefined, ParseResult.ParseError> =>
	Effect.map(
		Schema.decodeUnknown(NoteIdProbe)(frontmatter),
		probe => probe.noteId,
	)

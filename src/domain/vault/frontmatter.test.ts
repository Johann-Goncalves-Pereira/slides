import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import {
	decodeChapterNote,
	decodeCharacterNote,
	decodeEventSidecar,
} from './frontmatter'

describe('decodeCharacterNote', () => {
	it('uses the name as the character id when none is written', async () => {
		const note = await Effect.runPromise(
			decodeCharacterNote({
				noteId: 'note-arthur',
				name: 'Arthur',
				stats: { HP: 100 },
			}),
		)
		expect(note.characterId).toBe('Arthur')
		expect(note.stats.HP).toBe(100)
		expect(note.noteId).toBe('note-arthur')
	})
})

describe('decodeChapterNote', () => {
	it('maps order onto a chapter coordinate and defaults the branch', async () => {
		const note = await Effect.runPromise(
			decodeChapterNote({
				noteId: 'note-cap1',
				order: 1,
				timestamp: 10,
				act: 'I',
			}),
		)
		expect(note.coordinate).toEqual({
			branchId: 'main',
			chapterOrder: 1,
			sceneIndex: 0,
			beatIndex: 0,
			timestamp: 10,
		})
		expect(note.act).toBe('I')
		expect(note.overrides).toEqual({})
	})

	it('rejects an empty override map', async () => {
		const result = await Effect.runPromise(
			Effect.either(
				decodeChapterNote({
					noteId: 'note-cap1',
					order: 1,
					timestamp: 10,
					act: 'I',
					overrides: {},
				}),
			),
		)
		expect(result._tag).toBe('Left')
	})
})

describe('decodeEventSidecar', () => {
	it('rejects an unknown event type', async () => {
		const result = await Effect.runPromise(
			Effect.either(
				decodeEventSidecar({
					noteId: 'note-cap1',
					events: [
						{
							eventId: 'evt-1',
							targetEntity: 'Arthur',
							coordinate: {
								chapterOrder: 1,
								sceneIndex: 0,
								beatIndex: 0,
								timestamp: 10,
							},
							type: 'LEVEL_UP',
							stats: { HP: 1 },
						},
					],
				}),
			),
		)
		expect(result._tag).toBe('Left')
	})
})

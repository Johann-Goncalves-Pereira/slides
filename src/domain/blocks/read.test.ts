import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { indexNotes } from '../vault/index'
import {
	readCharacterSheet,
	readRelationshipMatrix,
	readRpgEvent,
} from './read'

const arthur = {
	path: 'Personagens/Arthur.md',
	kind: 'character' as const,
	frontmatter: {
		noteId: 'note-arthur',
		name: 'Arthur',
		stats: { HP: 100 },
	},
}

const damage = {
	eventId: 'evt-damage',
	targetEntity: 'Arthur',
	coordinate: {
		branchId: 'main',
		chapterOrder: 1,
		sceneIndex: 0,
		beatIndex: 0,
		timestamp: 10,
	},
	type: 'STAT_CHANGE' as const,
	deltas: { HP: -10 },
}

const trust = {
	eventId: 'evt-trust',
	targetEntity: 'Arthur',
	coordinate: {
		branchId: 'main',
		chapterOrder: 2,
		sceneIndex: 0,
		beatIndex: 0,
		timestamp: 20,
	},
	type: 'AFFINITY_SHIFT' as const,
	object: 'Merlin',
	axis: 'trust',
	delta: 15,
}

const chapter = (
	path: string,
	noteId: string,
	order: number,
	timestamp: number,
	events: readonly unknown[],
) => ({
	path,
	kind: 'chapter' as const,
	frontmatter: { noteId, order, timestamp, act: 'I' },
	sidecar: { noteId, tombstoned: false, events },
})

describe('reading blocks', () => {
	it('reads canon at the chapter and hides a later event', async () => {
		const index = await Effect.runPromise(
			indexNotes([
				arthur,
				chapter('Livro/Cap1.md', 'note-cap1', 1, 10, [damage]),
				chapter('Livro/Cap2.md', 'note-cap2', 2, 20, [trust]),
			]),
		)
		const early = await Effect.runPromise(
			readCharacterSheet(index, 'Livro/Cap1.md', 'Arthur'),
		)
		const late = await Effect.runPromise(
			readCharacterSheet(index, 'Livro/Cap2.md', ' Arthur\n'),
		)
		expect(early.stats.HP).toBe(90)
		expect(early.affinities).toEqual([])
		expect(late.stats.HP).toBe(90)
		expect(late.affinities).toEqual([
			{ object: 'Merlin', axis: 'trust', score: 15 },
		])
		const matrix = await Effect.runPromise(
			readRelationshipMatrix(index, 'Livro/Cap2.md', '\n'),
		)
		expect(matrix).toEqual([
			{ subject: 'Arthur', object: 'Merlin', axis: 'trust', score: 15 },
		])
		const visible = await Effect.runPromise(
			readRpgEvent(index, 'Livro/Cap2.md', 'evt-trust'),
		)
		expect(visible.eventId).toBe('evt-trust')
		const hidden = await Effect.runPromise(
			Effect.either(readRpgEvent(index, 'Livro/Cap1.md', 'evt-trust')),
		)
		const elsewhere = await Effect.runPromise(
			Effect.either(
				readCharacterSheet(index, 'Personagens/Arthur.md', 'Arthur'),
			),
		)
		const emptyMatrix = await Effect.runPromise(
			Effect.either(readRelationshipMatrix(index, 'Livro/Cap1.md', '')),
		)
		expect(hidden._tag).toBe('Left')
		expect(hidden._tag === 'Left' && hidden.left._tag).toBe('MissingEvent')
		expect(elsewhere._tag).toBe('Left')
		expect(elsewhere._tag === 'Left' && elsewhere.left._tag).toBe('NotAChapter')
		expect(emptyMatrix._tag).toBe('Left')
		expect(emptyMatrix._tag === 'Left' && emptyMatrix.left._tag).toBe(
			'EmptyMatrix',
		)
	})
})

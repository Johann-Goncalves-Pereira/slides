import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { Ledger } from '../story/ledger'
import { rehydrateAt } from '../story/rehydrate'
import {
	applyPathChange,
	indexNotes,
	ledgerFromIndex,
	sidecarPath,
} from './index'

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

const buried = {
	eventId: 'evt-tomb',
	targetEntity: 'Arthur',
	coordinate: {
		branchId: 'main',
		chapterOrder: 2,
		sceneIndex: 0,
		beatIndex: 0,
		timestamp: 20,
	},
	type: 'STAT_CHANGE' as const,
	deltas: { HP: -50 },
}

const chapter = (
	path: string,
	noteId: string,
	order: number,
	timestamp: number,
	events: readonly unknown[],
	tombstoned = false,
) => ({
	path,
	kind: 'chapter' as const,
	frontmatter: { noteId, order, timestamp, act: 'I' },
	sidecar: { noteId, tombstoned, events },
})

const cap1 = chapter('Livro/Cap1.md', 'note-cap1', 1, 10, [damage])
const cap2 = chapter('Livro/Cap2.md', 'note-cap2', 2, 20, [buried], true)

describe('indexNotes', () => {
	it('folds live sidecar events and leaves a tombstone out of the ledger', async () => {
		const index = await Effect.runPromise(
			indexNotes([
				arthur,
				cap1,
				cap2,
				{
					path: 'Mundo/Excalibur.md',
					kind: 'mundo',
					frontmatter: { noteId: 'note-sword' },
				},
			]),
		)
		expect(sidecarPath('Livro/Cap1.md')).toBe('Livro/Cap1.events.json')
		const first = index.byId.get('note-cap1')
		expect(first?.kind).toBe('chapter')
		if (first?.kind !== 'chapter') return
		expect(first.coordinate).toEqual(damage.coordinate)
		const second = index.byId.get('note-cap2')
		expect(second?.kind).toBe('chapter')
		if (second?.kind !== 'chapter') return
		expect(second.sidecar.events.map(event => event.eventId)).toEqual([
			'evt-tomb',
		])

		const ledger = await Effect.runPromise(ledgerFromIndex(index))
		const events = await Effect.runPromise(ledger.events)
		expect(events.map(event => event.eventId)).toEqual(['evt-damage'])
		const world = await Effect.runPromise(
			rehydrateAt(buried.coordinate).pipe(
				Effect.provideService(Ledger, ledger),
			),
		)
		expect(world.characters.Arthur?.stats.HP).toBe(90)
		expect(world.characters['note-sword']).toBeUndefined()
	})

	it('skips a note that has no note id', async () => {
		const index = await Effect.runPromise(
			indexNotes([
				arthur,
				{
					path: 'Personagens/Nameless.md',
					kind: 'character',
					frontmatter: { name: 'Nameless' },
				},
			]),
		)
		expect(index.byId.has('note-arthur')).toBe(true)
		expect(index.skipped.map(skip => skip.path)).toEqual([
			'Personagens/Nameless.md',
		])
		expect(index.skipped[0]?._tag).toBe('MissingNoteId')
	})
})

describe('applyPathChange', () => {
	it('renames a path without changing the note id or event ids', async () => {
		const index = await Effect.runPromise(indexNotes([arthur, cap1, cap2]))
		const renamed = await Effect.runPromise(
			applyPathChange(index, {
				type: 'rename',
				from: 'Livro/Cap1.md',
				to: 'Livro/Chapter1.md',
			}),
		)
		expect(renamed.byPath.get('Livro/Chapter1.md')).toBe('note-cap1')
		expect(renamed.byPath.has('Livro/Cap1.md')).toBe(false)
		const note = renamed.byId.get('note-cap1')
		expect(note?.kind).toBe('chapter')
		if (note?.kind !== 'chapter') return
		expect(note.sidecar.events.map(event => event.eventId)).toEqual([
			'evt-damage',
		])
	})

	it('tombstones the deleted chapter and leaves the other sidecar', async () => {
		const liveCap2 = chapter('Livro/Cap2.md', 'note-cap2', 2, 20, [buried])
		const index = await Effect.runPromise(indexNotes([arthur, cap1, liveCap2]))
		const deleted = await Effect.runPromise(
			applyPathChange(index, { type: 'delete', path: 'Livro/Cap1.md' }),
		)
		const removed = deleted.byId.get('note-cap1')
		expect(removed?.kind).toBe('chapter')
		if (removed?.kind !== 'chapter') return
		expect(removed.sidecar.tombstoned).toBe(true)
		expect(removed.sidecar.events.map(event => event.eventId)).toEqual([
			'evt-damage',
		])
		const kept = deleted.byId.get('note-cap2')
		expect(kept?.kind).toBe('chapter')
		if (kept?.kind !== 'chapter') return
		expect(kept.sidecar.tombstoned).toBe(false)
		expect(kept.sidecar.events.map(event => event.eventId)).toEqual([
			'evt-tomb',
		])
	})

	it('replaces one chapter without the other chapter body', async () => {
		const liveCap2 = chapter('Livro/Cap2.md', 'note-cap2', 2, 20, [buried])
		const index = await Effect.runPromise(indexNotes([arthur, cap1, liveCap2]))
		const changed = await Effect.runPromise(
			applyPathChange(index, {
				type: 'modify',
				file: chapter('Livro/Cap1.md', 'note-cap1', 1, 10, [
					{ ...damage, eventId: 'evt-heal', deltas: { HP: 15 } },
				]),
			}),
		)
		const edited = changed.byId.get('note-cap1')
		expect(edited?.kind).toBe('chapter')
		if (edited?.kind !== 'chapter') return
		expect(edited.sidecar.events.map(event => event.eventId)).toEqual([
			'evt-heal',
		])
		const kept = changed.byId.get('note-cap2')
		expect(kept?.kind).toBe('chapter')
		if (kept?.kind !== 'chapter') return
		expect(kept.sidecar.events.map(event => event.eventId)).toEqual([
			'evt-tomb',
		])
	})
})

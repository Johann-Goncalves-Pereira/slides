import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { appendOverrideSync, findStatDrift } from './drift'
import { indexNotes } from './index'

const arthur = {
	path: 'Personagens/Arthur.md',
	kind: 'character' as const,
	frontmatter: {
		noteId: 'note-arthur',
		name: 'Arthur',
		stats: { HP: 100, MP: 5 },
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
	deltas: { HP: -20 },
}

describe('findStatDrift', () => {
	it('reports a chapter override that disagrees with the fold', async () => {
		const index = await Effect.runPromise(
			indexNotes([
				arthur,
				{
					path: 'Livro/Cap1.md',
					kind: 'chapter',
					frontmatter: {
						noteId: 'note-cap1',
						order: 1,
						timestamp: 10,
						act: 'I',
						overrides: { Arthur: { HP: 50 } },
					},
					sidecar: { noteId: 'note-cap1', events: [damage] },
				},
				{
					path: 'Livro/Cap2.md',
					kind: 'chapter',
					frontmatter: {
						noteId: 'note-cap2',
						order: 2,
						timestamp: 20,
						act: 'I',
						overrides: { Arthur: { HP: 80 } },
					},
					sidecar: { noteId: 'note-cap2', events: [] },
				},
			]),
		)
		const drifts = await Effect.runPromise(findStatDrift(index))
		expect(drifts.map(drift => drift.noteId)).toEqual(['note-cap1'])
		const drift = drifts[0]
		expect(drift?.characterId).toBe('Arthur')
		expect(drift?.stats).toEqual({ HP: 50 })

		const chapter = index.byId.get('note-cap1')
		expect(chapter?.kind).toBe('chapter')
		if (chapter?.kind !== 'chapter' || drift === undefined) return
		const next = appendOverrideSync(chapter.sidecar, drift)
		expect(chapter.sidecar.events.map(event => event.eventId)).toEqual([
			'evt-damage',
		])
		expect(next.events).toHaveLength(2)
		expect(next.events[1]).toMatchObject({
			type: 'OVERRIDE_SYNC',
			targetEntity: 'Arthur',
			coordinate: damage.coordinate,
			stats: { HP: 50 },
		})
	})
})

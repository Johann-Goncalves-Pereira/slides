import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { sidecarPath } from '../domain/vault/index'
import { defaultPluginSettings } from '../domain/vault/roots'
import { createSession, type VaultPort } from './session'

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

const memoryPort = () => {
	const markdown = new Map<string, unknown>()
	const text = new Map<string, string>()
	const noteIdWrites: string[] = []
	const notices: string[] = []
	let nextId = 0
	const port: VaultPort = {
		settings: defaultPluginSettings,
		createNoteId: () => {
			nextId += 1
			return `id-${nextId}`
		},
		listMarkdown: root =>
			Effect.sync(() =>
				[...markdown.entries()]
					.filter(([path]) => path.startsWith(`${root}/`))
					.map(([path, frontmatter]) => ({ path, frontmatter })),
			),
		readText: path => Effect.sync(() => text.get(path)),
		writeText: (path, contents) =>
			Effect.sync(() => {
				text.set(path, contents)
			}),
		renameFile: (from, to) =>
			Effect.sync(() => {
				const contents = text.get(from)
				if (contents === undefined) return
				text.set(to, contents)
				text.delete(from)
			}),
		writeNoteId: (path, noteId) =>
			Effect.sync(() => {
				noteIdWrites.push(`${path}:${noteId}`)
			}),
		saveSettings: () => Effect.void,
		notice: message => {
			notices.push(message)
		},
	}
	return { port, markdown, text, noteIdWrites, notices }
}

describe('createSession', () => {
	it('indexes characters and chapter sidecars on load', async () => {
		const { port, markdown, text } = memoryPort()
		markdown.set('Personagens/Arthur.md', {
			noteId: 'note-arthur',
			name: 'Arthur',
			stats: { HP: 100 },
		})
		markdown.set('Livro/Cap1.md', {
			noteId: 'note-cap1',
			order: 1,
			timestamp: 10,
			act: 'I',
		})
		text.set(
			sidecarPath('Livro/Cap1.md'),
			JSON.stringify({ noteId: 'note-cap1', events: [damage] }),
		)
		const session = createSession(port)
		await Effect.runPromise(session.load())
		expect(session.index().byPath.get('Livro/Cap1.md')).toBe('note-cap1')
		const chapter = session.index().byId.get('note-cap1')
		expect(chapter?.kind).toBe('chapter')
		if (chapter?.kind !== 'chapter') return
		expect(chapter.sidecar.events.map(event => event.eventId)).toEqual([
			'evt-damage',
		])
	})

	it('assigns a missing note id once', async () => {
		const { port, markdown, noteIdWrites } = memoryPort()
		markdown.set('Personagens/Nameless.md', { name: 'Nameless' })
		const session = createSession(port)
		await Effect.runPromise(session.load())
		expect(noteIdWrites).toEqual(['Personagens/Nameless.md:id-1'])
		await Effect.runPromise(
			session.onChanged('Personagens/Nameless.md', { name: 'Nameless' }),
		)
		expect(noteIdWrites).toEqual(['Personagens/Nameless.md:id-1'])
		await Effect.runPromise(
			session.onChanged('Personagens/Nameless.md', {
				name: 'Nameless',
				noteId: 'id-1',
			}),
		)
		expect(session.index().byId.has('id-1')).toBe(true)
		expect(noteIdWrites).toHaveLength(1)
	})

	it('renames the sidecar with the chapter', async () => {
		const { port, markdown, text } = memoryPort()
		markdown.set('Personagens/Arthur.md', {
			noteId: 'note-arthur',
			name: 'Arthur',
			stats: { HP: 100 },
		})
		markdown.set('Livro/Cap1.md', {
			noteId: 'note-cap1',
			order: 1,
			timestamp: 10,
			act: 'I',
		})
		text.set(
			sidecarPath('Livro/Cap1.md'),
			JSON.stringify({ noteId: 'note-cap1', events: [damage] }),
		)
		const session = createSession(port)
		await Effect.runPromise(session.load())
		await Effect.runPromise(
			session.onRenamed('Livro/Cap1.md', 'Livro/Chapter1.md'),
		)
		expect(session.index().byPath.get('Livro/Chapter1.md')).toBe('note-cap1')
		expect(text.has(sidecarPath('Livro/Chapter1.md'))).toBe(true)
		expect(text.has(sidecarPath('Livro/Cap1.md'))).toBe(false)
		const note = session.index().byId.get('note-cap1')
		expect(note?.kind).toBe('chapter')
		if (note?.kind !== 'chapter') return
		expect(note.sidecar.events.map(event => event.eventId)).toEqual([
			'evt-damage',
		])
	})

	it('writes a tombstone for the deleted chapter only', async () => {
		const { port, markdown, text } = memoryPort()
		markdown.set('Personagens/Arthur.md', {
			noteId: 'note-arthur',
			name: 'Arthur',
			stats: { HP: 100 },
		})
		markdown.set('Livro/Cap1.md', {
			noteId: 'note-cap1',
			order: 1,
			timestamp: 10,
			act: 'I',
		})
		markdown.set('Livro/Cap2.md', {
			noteId: 'note-cap2',
			order: 2,
			timestamp: 20,
			act: 'I',
		})
		text.set(
			sidecarPath('Livro/Cap1.md'),
			JSON.stringify({ noteId: 'note-cap1', events: [damage] }),
		)
		text.set(
			sidecarPath('Livro/Cap2.md'),
			JSON.stringify({ noteId: 'note-cap2', events: [] }),
		)
		const session = createSession(port)
		await Effect.runPromise(session.load())
		await Effect.runPromise(session.onDeleted('Livro/Cap1.md'))
		const written = text.get(sidecarPath('Livro/Cap1.md'))
		expect(typeof written).toBe('string')
		if (typeof written !== 'string') return
		const parsed: unknown = JSON.parse(written)
		expect(parsed).toMatchObject({
			noteId: 'note-cap1',
			tombstoned: true,
			events: [expect.objectContaining({ eventId: 'evt-damage' })],
		})
		const kept = text.get(sidecarPath('Livro/Cap2.md'))
		expect(JSON.parse(kept ?? '')).toEqual({
			noteId: 'note-cap2',
			events: [],
		})
	})

	it('appends an override to the chapter sidecar', async () => {
		const { port, markdown, text, noteIdWrites, notices } = memoryPort()
		markdown.set('Personagens/Arthur.md', {
			noteId: 'note-arthur',
			name: 'Arthur',
			stats: { HP: 100, MP: 5 },
		})
		markdown.set('Livro/Cap1.md', {
			noteId: 'note-cap1',
			order: 1,
			timestamp: 10,
			act: 'I',
			overrides: { Arthur: { HP: 50 } },
		})
		text.set(
			sidecarPath('Livro/Cap1.md'),
			JSON.stringify({ noteId: 'note-cap1', events: [damage] }),
		)
		const session = createSession(port)
		await Effect.runPromise(session.load())
		expect(notices).toContain('Stat drift in Livro/Cap1.md.')
		await Effect.runPromise(session.appendActiveOverride('Livro/Cap1.md'))
		const written = text.get(sidecarPath('Livro/Cap1.md'))
		expect(typeof written).toBe('string')
		if (typeof written !== 'string') return
		const parsed: unknown = JSON.parse(written)
		expect(parsed).toMatchObject({
			events: [
				expect.objectContaining({ eventId: 'evt-damage' }),
				expect.objectContaining({
					type: 'OVERRIDE_SYNC',
					targetEntity: 'Arthur',
					stats: { HP: 50 },
				}),
			],
		})
		expect(noteIdWrites).toEqual([])
		expect(text.has('Personagens/Arthur.md')).toBe(false)
	})

	it('writes an accepted sidecar without touching the character note', async () => {
		const { port, markdown, text, noteIdWrites } = memoryPort()
		markdown.set('Personagens/Arthur.md', {
			noteId: 'note-arthur',
			name: 'Arthur',
			stats: { HP: 100 },
		})
		markdown.set('Livro/Cap1.md', {
			noteId: 'note-cap1',
			order: 1,
			timestamp: 10,
			act: 'I',
		})
		text.set(
			sidecarPath('Livro/Cap1.md'),
			JSON.stringify({ noteId: 'note-cap1', events: [damage] }),
		)
		const session = createSession(port)
		await Effect.runPromise(session.load())
		const accepted = {
			eventId: 'evt-new',
			targetEntity: 'Arthur',
			coordinate: damage.coordinate,
			type: 'STAT_CHANGE' as const,
			deltas: { HP: 1 },
		}
		await Effect.runPromise(
			session.writeChapterSidecar('Livro/Cap1.md', {
				noteId: 'note-cap1',
				tombstoned: false,
				events: [damage, accepted],
			}),
		)
		const written = text.get(sidecarPath('Livro/Cap1.md'))
		expect(typeof written).toBe('string')
		if (typeof written !== 'string') return
		const parsed: unknown = JSON.parse(written)
		expect(parsed).toMatchObject({
			events: [
				expect.objectContaining({ eventId: 'evt-damage' }),
				expect.objectContaining({ eventId: 'evt-new' }),
			],
		})
		const indexed = session.index().byId.get('note-cap1')
		expect(indexed?.kind).toBe('chapter')
		if (indexed?.kind !== 'chapter') return
		expect(indexed.sidecar.events.map(event => event.eventId)).toEqual([
			'evt-damage',
			'evt-new',
		])
		expect(noteIdWrites).toEqual([])
		expect(text.has('Personagens/Arthur.md')).toBe(false)
	})
})

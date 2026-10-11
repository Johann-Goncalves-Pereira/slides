import { Effect, type ParseResult } from 'effect'
import type { RehydrationError } from '../domain/story/errors'
import type { ReduceError } from '../domain/story/reduce'
import { appendOverrideSync, findStatDrift } from '../domain/vault/drift'
import type { EventSidecar } from '../domain/vault/frontmatter'
import { readNoteId } from '../domain/vault/frontmatter'
import {
	applyPathChange,
	emptyVaultIndex,
	type IndexError,
	type IndexedChapter,
	indexNotes,
	sidecarPath,
	type VaultFile,
	type VaultIndex,
} from '../domain/vault/index'
import {
	decodePluginSettings,
	type PluginSettings,
	type VaultRoots,
} from '../domain/vault/roots'
import { SidecarJsonError, type VaultIoError } from './errors'

export type MarkdownRecord = {
	readonly path: string
	readonly frontmatter: unknown
}

export type VaultPort = {
	readonly settings: PluginSettings
	readonly createNoteId: () => string
	readonly listMarkdown: (
		root: string,
	) => Effect.Effect<readonly MarkdownRecord[], VaultIoError>
	readonly readText: (
		path: string,
	) => Effect.Effect<string | undefined, VaultIoError>
	readonly writeText: (
		path: string,
		contents: string,
	) => Effect.Effect<void, VaultIoError>
	readonly renameFile: (
		from: string,
		to: string,
	) => Effect.Effect<void, VaultIoError>
	readonly writeNoteId: (
		path: string,
		noteId: string,
	) => Effect.Effect<void, VaultIoError>
	readonly saveSettings: (
		settings: PluginSettings,
	) => Effect.Effect<void, VaultIoError>
	readonly notice: (message: string) => void
}

export type SessionError =
	| VaultIoError
	| SidecarJsonError
	| IndexError
	| ReduceError
	| RehydrationError
	| ParseResult.ParseError

export type VaultSession = {
	readonly index: () => VaultIndex
	readonly roots: () => VaultRoots
	readonly settings: () => PluginSettings
	readonly load: () => Effect.Effect<void, SessionError>
	readonly onChanged: (
		path: string,
		frontmatter: unknown,
	) => Effect.Effect<void, SessionError>
	readonly onRenamed: (
		from: string,
		to: string,
	) => Effect.Effect<void, SessionError>
	readonly onDeleted: (path: string) => Effect.Effect<void, SessionError>
	readonly appendActiveOverride: (
		path: string | undefined,
	) => Effect.Effect<void, SessionError>
	readonly setRoot: (
		key: keyof VaultRoots,
		value: string,
	) => Effect.Effect<void, SessionError>
	readonly setModelField: (
		key: 'modelBaseUrl' | 'modelName',
		value: string,
	) => Effect.Effect<void, SessionError>
	readonly setPauseMillis: (
		pauseMillis: number,
	) => Effect.Effect<void, SessionError>
	readonly writeChapterSidecar: (
		path: string,
		sidecar: EventSidecar,
	) => Effect.Effect<void, SessionError>
}

const under = (path: string, root: string): boolean =>
	path.startsWith(`${root}/`)

const kindOf = (
	path: string,
	roots: VaultRoots,
): VaultFile['kind'] | undefined => {
	if (under(path, roots.livro)) return 'chapter'
	if (under(path, roots.personagens)) return 'character'
	if (under(path, roots.mundo)) return 'mundo'
	if (under(path, roots.assets)) return 'assets'
	return undefined
}

const withNoteId = (frontmatter: unknown, noteId: string): unknown => {
	if (
		typeof frontmatter === 'object' &&
		frontmatter !== null &&
		!Array.isArray(frontmatter)
	) {
		return { ...frontmatter, noteId }
	}
	return { noteId }
}

const parseJson = (
	contents: string,
	path: string,
): Effect.Effect<unknown, SidecarJsonError> =>
	Effect.try({
		try: () => {
			const value: unknown = JSON.parse(contents)
			return value
		},
		catch: cause => new SidecarJsonError({ path, cause }),
	})

const frontmatterFor = (note: IndexedChapter): unknown => {
	const frontmatter: {
		noteId: string
		order: number
		timestamp: number
		act: string
		branchId: string
		overrides?: IndexedChapter['overrides']
	} = {
		noteId: note.noteId,
		order: note.coordinate.chapterOrder,
		timestamp: note.coordinate.timestamp,
		act: note.act,
		branchId: note.coordinate.branchId,
	}
	if (Object.keys(note.overrides).length > 0) {
		frontmatter.overrides = note.overrides
	}
	return frontmatter
}

export const createSession = (port: VaultPort): VaultSession => {
	let settings = port.settings
	let index = emptyVaultIndex()
	const pending = new Map<string, string>()
	const announced = new Set<string>()
	const vaultRoots = (): VaultRoots => ({
		livro: settings.livro,
		personagens: settings.personagens,
		mundo: settings.mundo,
		assets: settings.assets,
	})

	const readSidecar = (
		path: string,
	): Effect.Effect<unknown, VaultIoError | SidecarJsonError> =>
		Effect.gen(function* () {
			const contents = yield* port.readText(sidecarPath(path))
			if (contents === undefined) return undefined
			return yield* parseJson(contents, sidecarPath(path))
		})

	const writeSidecar = (
		path: string,
		sidecar: EventSidecar,
	): Effect.Effect<void, VaultIoError> =>
		port.writeText(sidecarPath(path), JSON.stringify(sidecar))

	const assignNoteId = (path: string): Effect.Effect<string, VaultIoError> =>
		Effect.gen(function* () {
			const existing = pending.get(path)
			if (existing !== undefined) return existing
			const noteId = port.createNoteId()
			pending.set(path, noteId)
			const wrote = yield* Effect.either(port.writeNoteId(path, noteId))
			if (wrote._tag === 'Left') {
				pending.delete(path)
				return yield* wrote.left
			}
			return noteId
		})

	const announceDrift = (): Effect.Effect<void, SessionError> =>
		Effect.gen(function* () {
			const drifts = yield* findStatDrift(index)
			const paths = new Set(drifts.map(drift => drift.path))
			for (const path of paths) {
				if (announced.has(path)) continue
				announced.add(path)
				port.notice(`Stat drift in ${path}.`)
			}
			for (const path of announced) {
				if (!paths.has(path)) announced.delete(path)
			}
		})

	const fileFrom = (
		path: string,
		kind: VaultFile['kind'],
		frontmatter: unknown,
	): Effect.Effect<VaultFile, SessionError> =>
		Effect.gen(function* () {
			const noteId = yield* readNoteId(frontmatter)
			const body =
				noteId === undefined
					? withNoteId(frontmatter, yield* assignNoteId(path))
					: frontmatter
			if (noteId !== undefined) pending.delete(path)
			const sidecar = kind === 'chapter' ? yield* readSidecar(path) : undefined
			return { path, kind, frontmatter: body, sidecar }
		})

	const load: VaultSession['load'] = () =>
		Effect.gen(function* () {
			const files: VaultFile[] = []
			const rootsToScan = [
				vaultRoots().livro,
				vaultRoots().personagens,
				vaultRoots().mundo,
				vaultRoots().assets,
			]
			for (const root of rootsToScan) {
				const records = yield* port.listMarkdown(root)
				for (const record of records) {
					const kind = kindOf(record.path, vaultRoots())
					if (kind === undefined) continue
					files.push(yield* fileFrom(record.path, kind, record.frontmatter))
				}
			}
			index = yield* indexNotes(files)
			yield* announceDrift()
		})

	const onChanged: VaultSession['onChanged'] = (path, frontmatter) =>
		Effect.gen(function* () {
			const kind = kindOf(path, vaultRoots())
			if (kind === undefined) return
			const noteId = yield* readNoteId(frontmatter)
			if (noteId === undefined) {
				if (pending.has(path)) return
				yield* assignNoteId(path)
				return
			}
			pending.delete(path)
			const sidecar = kind === 'chapter' ? yield* readSidecar(path) : undefined
			index = yield* applyPathChange(index, {
				type: 'modify',
				file: { path, kind, frontmatter, sidecar },
			})
			yield* announceDrift()
		})

	const renameOne = (
		from: string,
		to: string,
	): Effect.Effect<void, SessionError> =>
		Effect.gen(function* () {
			if (kindOf(from, vaultRoots()) === 'chapter') {
				const contents = yield* port.readText(sidecarPath(from))
				if (contents !== undefined) {
					yield* port.renameFile(sidecarPath(from), sidecarPath(to))
				}
			}
			index = yield* applyPathChange(index, { type: 'rename', from, to })
		})

	const onRenamed: VaultSession['onRenamed'] = (from, to) =>
		Effect.gen(function* () {
			if (index.byPath.has(from) || kindOf(from, vaultRoots()) !== undefined) {
				yield* renameOne(from, to)
				return
			}
			const children = [...index.byPath.keys()].filter(path =>
				path.startsWith(`${from}/`),
			)
			for (const child of children) {
				yield* renameOne(child, `${to}${child.slice(from.length)}`)
			}
		})

	const onDeleted: VaultSession['onDeleted'] = path =>
		Effect.gen(function* () {
			const targets = index.byPath.has(path)
				? [path]
				: [...index.byPath.keys()].filter(notePath =>
						notePath.startsWith(`${path}/`),
					)
			for (const target of targets) {
				const noteId = index.byPath.get(target)
				const current =
					noteId === undefined ? undefined : index.byId.get(noteId)
				index = yield* applyPathChange(index, { type: 'delete', path: target })
				if (current?.kind !== 'chapter') continue
				const tombstoned = index.byId.get(current.noteId)
				if (tombstoned?.kind !== 'chapter') continue
				yield* writeSidecar(target, tombstoned.sidecar)
			}
		})

	const appendActiveOverride: VaultSession['appendActiveOverride'] = path =>
		Effect.gen(function* () {
			if (path === undefined) {
				port.notice('Open a chapter to append an override.')
				return
			}
			const drifts = yield* findStatDrift(index)
			const mine = drifts.filter(drift => drift.path === path)
			if (mine.length === 0) {
				port.notice('No stat drift on this chapter.')
				return
			}
			const noteId = index.byPath.get(path)
			const note = noteId === undefined ? undefined : index.byId.get(noteId)
			if (note?.kind !== 'chapter') {
				port.notice('Overrides apply to a chapter note.')
				return
			}
			const sidecar = mine.reduce(
				(current, drift) => appendOverrideSync(current, drift),
				note.sidecar,
			)
			yield* writeSidecar(path, sidecar)
			index = yield* applyPathChange(index, {
				type: 'modify',
				file: {
					path,
					kind: 'chapter',
					frontmatter: frontmatterFor(note),
					sidecar,
				},
			})
		})

	const setRoot: VaultSession['setRoot'] = (key, value) =>
		Effect.gen(function* () {
			const trimmed = value.trim()
			if (trimmed.length === 0) {
				port.notice('A vault root cannot be empty.')
				return
			}
			settings = { ...settings, [key]: trimmed }
			yield* port.saveSettings(settings)
			yield* load()
		})

	const setModelField: VaultSession['setModelField'] = (key, value) =>
		Effect.gen(function* () {
			const trimmed = value.trim()
			if (trimmed.length === 0) {
				port.notice('The model setting cannot be empty.')
				return
			}
			const decoded = yield* Effect.either(
				decodePluginSettings({ ...settings, [key]: trimmed }),
			)
			if (decoded._tag === 'Left') {
				port.notice('Could not save the model setting.')
				return
			}
			settings = decoded.right
			yield* port.saveSettings(settings)
		})

	const setPauseMillis: VaultSession['setPauseMillis'] = pauseMillis =>
		Effect.gen(function* () {
			const decoded = yield* Effect.either(
				decodePluginSettings({ ...settings, pauseMillis }),
			)
			if (decoded._tag === 'Left') {
				port.notice(
					'Pause must be a non-negative whole number of milliseconds.',
				)
				return
			}
			settings = decoded.right
			yield* port.saveSettings(settings)
		})

	const writeChapterSidecar: VaultSession['writeChapterSidecar'] = (
		path,
		sidecar,
	) =>
		Effect.gen(function* () {
			const noteId = index.byPath.get(path)
			const note = noteId === undefined ? undefined : index.byId.get(noteId)
			if (note?.kind !== 'chapter') {
				port.notice('Accept applies to a chapter note.')
				return
			}
			yield* writeSidecar(path, sidecar)
			index = yield* applyPathChange(index, {
				type: 'modify',
				file: {
					path,
					kind: 'chapter',
					frontmatter: frontmatterFor(note),
					sidecar,
				},
			})
		})

	return {
		index: () => index,
		roots: vaultRoots,
		settings: () => settings,
		load,
		onChanged,
		onRenamed,
		onDeleted,
		appendActiveOverride,
		setRoot,
		setModelField,
		setPauseMillis,
		writeChapterSidecar,
	}
}

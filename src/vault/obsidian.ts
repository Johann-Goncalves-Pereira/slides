import { Effect } from 'effect'
import { Notice, type Plugin } from 'obsidian'
import {
	decodePluginSettings,
	type PluginSettings,
} from '../domain/vault/roots'
import { VaultIoError } from './errors'
import type { VaultPort } from './session'

export const loadStoredSettings = (
	plugin: Plugin,
): Effect.Effect<PluginSettings, VaultIoError> =>
	Effect.gen(function* () {
		const data = yield* Effect.tryPromise({
			try: () => plugin.loadData(),
			catch: cause =>
				new VaultIoError({
					message: 'Could not read plugin data.',
					cause,
				}),
		})
		const raw: unknown = data
		return yield* decodePluginSettings(raw ?? {}).pipe(
			Effect.mapError(
				cause =>
					new VaultIoError({
						message: 'Could not read plugin settings.',
						cause,
					}),
			),
		)
	})

export const runVault = (effect: Effect.Effect<void, unknown>): void => {
	void Effect.runPromise(effect).catch((cause: unknown) => {
		console.error(cause)
		new Notice('Writing could not update the vault index.')
	})
}

export const obsidianPort = (
	plugin: Plugin,
	settings: PluginSettings,
): VaultPort => ({
	settings,
	createNoteId: () => crypto.randomUUID(),
	listMarkdown: root =>
		Effect.sync(() =>
			plugin.app.vault
				.getMarkdownFiles()
				.filter(file => file.path === root || file.path.startsWith(`${root}/`))
				.map(file => ({
					path: file.path,
					frontmatter:
						plugin.app.metadataCache.getFileCache(file)?.frontmatter ?? {},
				})),
		),
	readText: path =>
		Effect.tryPromise({
			try: async () => {
				const present = await plugin.app.vault.adapter.exists(path)
				if (!present) return undefined
				return plugin.app.vault.adapter.read(path)
			},
			catch: cause =>
				new VaultIoError({ message: `Could not read ${path}.`, cause }),
		}),
	writeText: (path, contents) =>
		Effect.tryPromise({
			try: () => plugin.app.vault.adapter.write(path, contents),
			catch: cause =>
				new VaultIoError({ message: `Could not write ${path}.`, cause }),
		}),
	renameFile: (from, to) =>
		Effect.tryPromise({
			try: () => plugin.app.vault.adapter.rename(from, to),
			catch: cause =>
				new VaultIoError({
					message: `Could not rename ${from}.`,
					cause,
				}),
		}),
	writeNoteId: (path, noteId) => {
		const file = plugin.app.vault.getFileByPath(path)
		if (file === null) {
			return Effect.fail(
				new VaultIoError({
					message: `Could not find ${path}.`,
					cause: undefined,
				}),
			)
		}
		return Effect.tryPromise({
			try: () =>
				plugin.app.fileManager.processFrontMatter(file, frontmatter => {
					frontmatter.noteId = noteId
				}),
			catch: cause =>
				new VaultIoError({
					message: `Could not assign an id to ${path}.`,
					cause,
				}),
		})
	},
	saveSettings: next =>
		Effect.tryPromise({
			try: () => plugin.saveData(next),
			catch: cause =>
				new VaultIoError({
					message: 'Could not save plugin settings.',
					cause,
				}),
		}),
	notice: message => {
		new Notice(message)
	},
})

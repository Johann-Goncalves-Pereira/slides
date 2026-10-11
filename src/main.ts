import { Effect } from 'effect'
import { Notice, Plugin } from 'obsidian'
import { runLoad } from './domain/manifest'
import { defaultPluginSettings } from './domain/vault/roots'
import { loadStoredSettings, obsidianPort, runVault } from './vault/obsidian'
import { createSession } from './vault/session'
import { WritingSettingTab } from './vault/settings'

export default class WritingPlugin extends Plugin {
	async onload() {
		await Effect.runPromise(runLoad())
		const settings = await Effect.runPromise(
			loadStoredSettings(this).pipe(
				Effect.catchAll(error =>
					Effect.sync(() => {
						new Notice(error.message)
						return defaultPluginSettings
					}),
				),
			),
		)
		const session = createSession(obsidianPort(this, settings))
		this.addSettingTab(new WritingSettingTab(this.app, this, session))
		this.addCommand({
			id: 'append-override-sync',
			name: 'append override sync',
			callback: () => {
				runVault(
					session.appendActiveOverride(
						this.app.workspace.getActiveFile()?.path,
					),
				)
			},
		})
		this.registerEvent(
			this.app.metadataCache.on('changed', (file, _data, cache) => {
				runVault(session.onChanged(file.path, cache.frontmatter ?? {}))
			}),
		)
		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				runVault(session.onRenamed(oldPath, file.path))
			}),
		)
		this.registerEvent(
			this.app.vault.on('delete', file => {
				runVault(session.onDeleted(file.path))
			}),
		)
		runVault(session.load())
	}
}

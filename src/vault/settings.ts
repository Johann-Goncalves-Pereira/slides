import { type App, type Plugin, PluginSettingTab, Setting } from 'obsidian'
import { defaultPluginSettings, defaultVaultRoots } from '../domain/vault/roots'
import { runVault } from './obsidian'
import type { VaultSession } from './session'

const rootKeys = ['livro', 'personagens', 'mundo', 'assets'] as const

const labels: Record<(typeof rootKeys)[number], string> = {
	livro: 'Livro',
	personagens: 'Personagens',
	mundo: 'Mundo',
	assets: 'Assets',
}

export class WritingSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		plugin: Plugin,
		private readonly session: VaultSession,
	) {
		super(app, plugin)
	}

	display(): void {
		const { containerEl } = this
		containerEl.empty()
		containerEl.createEl('h2', { text: 'Writing' })
		const roots = this.session.roots()
		for (const key of rootKeys) {
			new Setting(containerEl)
				.setName(labels[key])
				.setDesc(`Notes for this root live in ${labels[key]}.`)
				.addText(text => {
					text.setPlaceholder(defaultVaultRoots[key])
					text.setValue(roots[key])
					text.onChange(value => {
						runVault(this.session.setRoot(key, value))
					})
					return text
				})
		}
		const settings = this.session.settings()
		new Setting(containerEl)
			.setName('Model URL')
			.setDesc('Local model server. The default is Ollama on this machine.')
			.addText(text => {
				text.setPlaceholder(defaultPluginSettings.modelBaseUrl)
				text.setValue(settings.modelBaseUrl)
				text.onChange(value => {
					runVault(this.session.setModelField('modelBaseUrl', value))
				})
				return text
			})
		new Setting(containerEl)
			.setName('Model name')
			.setDesc('Model the server should run for extraction.')
			.addText(text => {
				text.setPlaceholder(defaultPluginSettings.modelName)
				text.setValue(settings.modelName)
				text.onChange(value => {
					runVault(this.session.setModelField('modelName', value))
				})
				return text
			})
		new Setting(containerEl)
			.setName('Extraction pause')
			.setDesc('Seconds to wait after a wikilink edit before asking the model.')
			.addText(text => {
				text.setPlaceholder(String(defaultPluginSettings.pauseMillis / 1000))
				text.setValue(String(settings.pauseMillis / 1000))
				text.onChange(value => {
					if (!/^\d+$/.test(value)) return
					runVault(this.session.setPauseMillis(Number(value) * 1000))
				})
				return text
			})
	}
}

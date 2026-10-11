import { Effect } from 'effect'
import { ItemView, Notice, type WorkspaceLeaf } from 'obsidian'
import { parseCues } from '../domain/audio/cues'
import { runVault } from '../vault/obsidian'
import type { PlaybackEngine } from './engine'

export const AUDIO_VIEW_TYPE = 'writing-audio'

const closers = new Set<() => void>()

export const closeAudioViews = (): void => {
	for (const close of [...closers]) close()
}

export class AudioLeaf extends ItemView {
	private closed = false
	private readonly closeLeaf = (): void => {
		if (this.closed) return
		this.closed = true
		closers.delete(this.closeLeaf)
		runVault(this.engine.release('leaf'))
		this.contentEl.empty()
	}

	constructor(
		leaf: WorkspaceLeaf,
		private readonly engine: PlaybackEngine,
	) {
		super(leaf)
	}

	getViewType(): string {
		return AUDIO_VIEW_TYPE
	}

	getDisplayText(): string {
		return 'Audio'
	}

	getIcon(): string {
		return 'music'
	}

	async onOpen(): Promise<void> {
		closers.add(this.closeLeaf)
		await this.render()
		this.registerEvent(
			this.app.workspace.on('file-open', () => {
				void this.render().catch(() => undefined)
			}),
		)
	}

	async onClose(): Promise<void> {
		this.closeLeaf()
	}

	private async render(): Promise<void> {
		if (this.closed) return
		const file = this.app.workspace.getActiveFile()
		const text =
			file === null
				? ''
				: await Effect.runPromise(
						Effect.tryPromise({
							try: () => this.app.vault.cachedRead(file),
							catch: () => 'Could not read the active note.',
						}).pipe(
							Effect.catchAll(message =>
								Effect.sync(() => {
									new Notice(message)
									return ''
								}),
							),
						),
					)
		if (this.closed) return
		const parsed = parseCues(text)
		const { contentEl } = this
		contentEl.empty()
		contentEl.createEl('h2', { text: 'Audio' })
		if (parsed.cues.length === 0) {
			contentEl.createEl('p', { text: 'This note has no audio cues.' })
		}
		for (const cue of parsed.cues) {
			const button = contentEl.createEl('button', { text: cue.file })
			button.addEventListener('click', () => {
				runVault(this.engine.play(cue, 'leaf'))
			})
		}
		const overlay = contentEl.createEl('input', { type: 'text' })
		overlay.placeholder = 'rain.mp3'
		const start = contentEl.createEl('button', { text: 'Start overlay' })
		start.addEventListener('click', () => {
			runVault(this.engine.overlay(overlay.value.trim(), true))
		})
		const stop = contentEl.createEl('button', { text: 'Stop overlay' })
		stop.addEventListener('click', () => {
			runVault(this.engine.overlay(overlay.value.trim(), false))
		})
	}
}

import { Effect, Exit, Scope } from 'effect'
import { Notice, Plugin } from 'obsidian'
import { ollamaModel } from './api/api-client'
import { wikilinkEdits } from './domain/extract/beats'
import { ModelClient } from './domain/extract/model'
import { ExtractionError } from './domain/extract/proposal'
import {
	type ExtractionQueue,
	type ExtractionRequest,
	makeExtractionQueue,
} from './domain/extract/queue'
import { runLoad } from './domain/manifest'
import { defaultPluginSettings } from './domain/vault/roots'
import { closeHudViews, HUD_VIEW_TYPE, WritingHudView } from './hud/view'
import { loadStoredSettings, obsidianPort, runVault } from './vault/obsidian'
import { ProposalModal } from './vault/proposal-modal'
import { createSession, type VaultSession } from './vault/session'
import { WritingSettingTab } from './vault/settings'

const chapterAt = (session: VaultSession, path: string) => {
	const noteId = session.index().byPath.get(path)
	const note =
		noteId === undefined ? undefined : session.index().byId.get(noteId)
	if (note?.kind !== 'chapter') return undefined
	return note
}

const errorMessage = (cause: unknown): string => {
	if (
		typeof cause === 'object' &&
		cause !== null &&
		'message' in cause &&
		typeof cause.message === 'string'
	) {
		return cause.message
	}
	return 'Could not write the chapter sidecar.'
}

export default class WritingPlugin extends Plugin {
	private closeExtraction: Effect.Effect<void> | undefined

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
		const scope = await Effect.runPromise(Scope.make())
		this.closeExtraction = Scope.close(scope, Exit.void)
		let proposalModal: ProposalModal | undefined
		const extraction: { queue?: ExtractionQueue } = {}
		const queue = await Effect.runPromise(
			makeExtractionQueue(scope, {
				readSidecar: path =>
					Effect.gen(function* () {
						const chapter = chapterAt(session, path)
						if (chapter === undefined) {
							return yield* Effect.fail(
								new ExtractionError({
									message: 'Extraction applies to a chapter note.',
								}),
							)
						}
						return chapter.sidecar
					}),
				writeSidecar: (path, sidecar) =>
					session
						.writeChapterSidecar(path, sidecar)
						.pipe(
							Effect.mapError(
								cause => new ExtractionError({ message: errorMessage(cause) }),
							),
						),
				notice: message => {
					new Notice(message)
				},
				onProposal: (path, events) => {
					const current = extraction.queue
					if (current === undefined) return
					proposalModal?.close()
					proposalModal = new ProposalModal(
						this.app,
						events,
						() => {
							runVault(current.acceptProposal(path))
						},
						() => {
							runVault(current.rejectProposal(path))
						},
					)
					proposalModal.open()
				},
			}),
		)
		extraction.queue = queue
		const model = {
			propose: (prompt: string) =>
				ollamaModel(session.settings()).propose(prompt),
		}
		const enqueue = (request: ExtractionRequest) =>
			queue.enqueue(request).pipe(Effect.provideService(ModelClient, model))
		const lastText = new Map<string, string>()
		this.addSettingTab(new WritingSettingTab(this.app, this, session))
		this.registerView(HUD_VIEW_TYPE, leaf => new WritingHudView(leaf, session))
		this.addCommand({
			id: 'open-relationship-hud',
			name: 'open relationship hud',
			callback: () => {
				void this.app.workspace
					.getLeaf(true)
					.setViewState({ type: HUD_VIEW_TYPE, active: true })
					.catch((cause: unknown) => {
						console.error(cause)
						new Notice('Could not open the relationship HUD.')
					})
			},
		})
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
		this.addCommand({
			id: 'extract-chapter',
			name: 'extract chapter',
			callback: () => {
				const path = this.app.workspace.getActiveFile()?.path
				if (path === undefined) {
					new Notice('Open a chapter to extract.')
					return
				}
				const vault = this.app.vault
				runVault(
					Effect.gen(function* () {
						const chapter = chapterAt(session, path)
						if (chapter === undefined) {
							new Notice('Open a chapter to extract.')
							return
						}
						const raw: unknown = yield* Effect.tryPromise({
							try: () => vault.adapter.read(path),
							catch: () =>
								new ExtractionError({
									message: `Could not read ${path}.`,
								}),
						})
						if (typeof raw !== 'string') {
							return yield* Effect.fail(
								new ExtractionError({
									message: `Could not read ${path}.`,
								}),
							)
						}
						yield* enqueue({
							chapterPath: path,
							noteId: chapter.noteId,
							text: raw,
							coordinate: chapter.coordinate,
							pauseMillis: 0,
						})
					}),
				)
			},
		})
		this.addCommand({
			id: 'accept-proposal',
			name: 'accept proposal',
			callback: () => {
				const path = this.app.workspace.getActiveFile()?.path
				if (path === undefined) {
					new Notice('Open a chapter to accept a proposal.')
					return
				}
				proposalModal?.close()
				runVault(queue.acceptProposal(path))
			},
		})
		this.addCommand({
			id: 'reject-proposal',
			name: 'reject proposal',
			callback: () => {
				const path = this.app.workspace.getActiveFile()?.path
				if (path === undefined) {
					new Notice('Open a chapter to reject a proposal.')
					return
				}
				proposalModal?.close()
				runVault(queue.rejectProposal(path))
			},
		})
		this.registerEvent(
			this.app.metadataCache.on('changed', (file, data, cache) => {
				runVault(
					Effect.gen(function* () {
						yield* session.onChanged(file.path, cache.frontmatter ?? {})
						const chapter = chapterAt(session, file.path)
						if (chapter === undefined) return
						const previous = lastText.get(file.path)
						lastText.set(file.path, data)
						if (previous === undefined) return
						if (wikilinkEdits(previous, data, session.roots()).length === 0) {
							return
						}
						yield* enqueue({
							chapterPath: file.path,
							noteId: chapter.noteId,
							text: data,
							coordinate: chapter.coordinate,
							pauseMillis: session.settings().pauseMillis,
						})
					}),
				)
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

	onunload(): void {
		closeHudViews()
		const closeExtraction = this.closeExtraction
		if (closeExtraction === undefined) return
		void Effect.runPromise(closeExtraction).catch((cause: unknown) => {
			console.error(cause)
		})
	}
}

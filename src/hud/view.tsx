import flowStyles from '@xyflow/react/dist/style.css'
import { Effect } from 'effect'
import { ItemView, Notice, type WorkspaceLeaf } from 'obsidian'
import { createRoot, type Root } from 'react-dom/client'
import { projectGraph } from '../domain/hud/graph'
import { storyStops } from '../domain/hud/stops'
import type { StoryCoordinate } from '../domain/story/coordinate'
import { RehydrationError } from '../domain/story/errors'
import { Ledger } from '../domain/story/ledger'
import { rehydrateAt } from '../domain/story/rehydrate'
import { eventCoordinates, ledgerFromIndex } from '../domain/vault/index'
import type { VaultSession } from '../vault/session'
import { createLayoutWorker, type LayoutPort } from './layout-worker'
import { type HudActions, HudPanel } from './panel'

export const HUD_VIEW_TYPE = 'writing-hud'

const closers = new Set<() => void>()

export const closeHudViews = (): void => {
	for (const close of [...closers]) close()
}

const hudCss = `
.writing-hud {
	background: #0B0F19;
	color: #D4AF37;
	font-family: Inter, sans-serif;
	height: 100%;
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding: 12px;
	overflow: auto;
}
.writing-hud h2 {
	font-family: Cinzel, Palatino, "Palatino Linotype", serif;
	color: #00E5FF;
	margin: 0;
}
.writing-hud select,
.writing-hud input {
	font-family: Inter, sans-serif;
}
.writing-hud .writing-graph {
	height: 320px;
	background: #1E1611;
	border: 1px solid #D4AF37;
}
.writing-hud .writing-radar {
	width: 160px;
	height: 160px;
}
`

const readError = (cause: unknown): RehydrationError =>
	new RehydrationError({
		message:
			typeof cause === 'object' &&
			cause !== null &&
			'message' in cause &&
			typeof cause.message === 'string'
				? cause.message
				: 'Could not read the story at this coordinate.',
	})

const branchIds = (session: VaultSession): readonly string[] => {
	const ids = new Set<string>(['main'])
	for (const note of session.index().byId.values()) {
		if (note.kind === 'chapter') ids.add(note.coordinate.branchId)
	}
	return [...ids].sort()
}

const stopList = (
	session: VaultSession,
	branchId: string,
): readonly StoryCoordinate[] => {
	const chapters = []
	const events = []
	for (const note of session.index().byId.values()) {
		if (note.kind !== 'chapter') continue
		chapters.push({
			coordinate: note.coordinate,
			tombstoned: note.sidecar.tombstoned,
		})
		if (note.sidecar.tombstoned) continue
		for (const event of note.sidecar.events) {
			events.push({ coordinate: event.coordinate })
		}
	}
	return storyStops(chapters, branchId, events)
}

const loadCoordinate = (
	session: VaultSession,
	worker: LayoutPort,
	coordinate: StoryCoordinate,
) =>
	Effect.gen(function* () {
		const ledger = yield* ledgerFromIndex(session.index()).pipe(
			Effect.mapError(cause => readError(cause)),
		)
		const world = yield* rehydrateAt(coordinate).pipe(
			Effect.provideService(Ledger, ledger),
			Effect.mapError(cause => readError(cause)),
		)
		const graph = yield* projectGraph(world).pipe(
			Effect.mapError(cause => readError(cause)),
		)
		const positions = yield* worker.layout(graph)
		return {
			world,
			graph,
			positions,
			at: coordinate,
			scenes: eventCoordinates(session.index(), coordinate),
		}
	})

export class WritingHudView extends ItemView {
	private root: Root | undefined
	private worker: LayoutPort | undefined
	private actions: HudActions | undefined
	private revision = 0
	private closed = false
	private readonly close = (): void => {
		if (this.closed) return
		this.closed = true
		closers.delete(this.close)
		this.worker?.terminate()
		this.root?.unmount()
		this.root = undefined
		this.contentEl.empty()
	}

	constructor(
		leaf: WorkspaceLeaf,
		private readonly session: VaultSession,
	) {
		super(leaf)
	}

	getViewType(): string {
		return HUD_VIEW_TYPE
	}

	getDisplayText(): string {
		return 'Writing'
	}

	getIcon(): string {
		return 'network'
	}

	async onOpen(): Promise<void> {
		const worker = createLayoutWorker()
		this.worker = worker
		this.actions = {
			branches: () => branchIds(this.session),
			stops: branchId => stopList(this.session, branchId),
			loadAt: coordinate => loadCoordinate(this.session, worker, coordinate),
			notice: message => {
				new Notice(message)
			},
		}
		this.contentEl.empty()
		const style = this.contentEl.createEl('style')
		style.textContent = `${flowStyles}\n${hudCss}`
		const mount = this.contentEl.createDiv()
		this.root = createRoot(mount)
		this.renderPanel()
		this.registerEvent(
			this.app.metadataCache.on('changed', () => {
				this.bump()
			}),
		)
		this.registerEvent(
			this.app.vault.on('rename', () => {
				this.bump()
			}),
		)
		this.registerEvent(
			this.app.vault.on('delete', () => {
				this.bump()
			}),
		)
		closers.add(this.close)
	}

	async onClose(): Promise<void> {
		this.close()
	}

	private bump(): void {
		if (this.closed) return
		this.revision += 1
		this.renderPanel()
	}

	private renderPanel(): void {
		const actions = this.actions
		if (actions === undefined) return
		this.root?.render(<HudPanel revision={this.revision} actions={actions} />)
	}
}

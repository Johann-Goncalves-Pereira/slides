import { Effect } from 'effect'
import {
	type MarkdownPostProcessorContext,
	MarkdownRenderChild,
	type Plugin,
} from 'obsidian'
import { createRoot, type Root } from 'react-dom/client'
import {
	readCharacterSheet,
	readRelationshipMatrix,
	readRpgEvent,
} from '../domain/blocks/read'
import { runVault } from '../vault/obsidian'
import type { VaultSession } from '../vault/session'
import {
	BlockNotice,
	blockCss,
	blockMessage,
	CharacterSheetBlock,
	RelationshipMatrixBlock,
	RpgEventBlock,
} from './blocks'

const listeners = new Set<() => void>()
const closers = new Set<() => void>()

export const refreshBlocks = (): void => {
	for (const listener of [...listeners]) listener()
}

const subscribeBlocks = (listener: () => void): (() => void) => {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

export const closeEditorBlocks = (): void => {
	for (const close of [...closers]) close()
}

class BlockMount extends MarkdownRenderChild {
	private closed = false
	private readonly stop: () => void
	private readonly close = (): void => {
		if (this.closed) return
		this.closed = true
		closers.delete(this.close)
		this.stop()
		this.root.unmount()
	}

	constructor(
		container: HTMLElement,
		private readonly root: Root,
		repaint: () => void,
	) {
		super(container)
		this.stop = subscribeBlocks(() => {
			if (!this.closed) repaint()
		})
		closers.add(this.close)
	}

	onunload(): void {
		this.close()
	}
}

const mount = (
	element: HTMLElement,
	context: MarkdownPostProcessorContext,
	render: (root: Root) => void,
): void => {
	const root = createRoot(element)
	context.addChild(new BlockMount(element, root, () => render(root)))
	render(root)
}

export const registerEditorBlocks = (
	plugin: Plugin,
	session: VaultSession,
): (() => void) => {
	const style = document.createElement('style')
	style.textContent = blockCss
	document.head.append(style)
	plugin.registerMarkdownCodeBlockProcessor(
		'character-sheet',
		(source, el, ctx) => {
			mount(el, ctx, root => {
				const result = Effect.runSync(
					Effect.either(
						readCharacterSheet(session.index(), ctx.sourcePath, source),
					),
				)
				root.render(
					result._tag === 'Left' ? (
						<BlockNotice message={blockMessage(result.left)} />
					) : (
						<CharacterSheetBlock sheet={result.right} />
					),
				)
			})
		},
	)
	plugin.registerMarkdownCodeBlockProcessor(
		'relationship-matrix',
		(source, el, ctx) => {
			mount(el, ctx, root => {
				const result = Effect.runSync(
					Effect.either(
						readRelationshipMatrix(session.index(), ctx.sourcePath, source),
					),
				)
				root.render(
					result._tag === 'Left' ? (
						<BlockNotice message={blockMessage(result.left)} />
					) : (
						<RelationshipMatrixBlock rows={result.right} />
					),
				)
			})
		},
	)
	plugin.registerMarkdownCodeBlockProcessor('rpg-event', (source, el, ctx) => {
		mount(el, ctx, root => {
			const result = Effect.runSync(
				Effect.either(readRpgEvent(session.index(), ctx.sourcePath, source)),
			)
			if (result._tag === 'Left') {
				root.render(<BlockNotice message={blockMessage(result.left)} />)
				return
			}
			const event = result.right
			root.render(
				<RpgEventBlock
					event={event}
					onRemove={() => {
						runVault(
							session
								.removeEvent(event.eventId)
								.pipe(Effect.tap(() => Effect.sync(refreshBlocks))),
						)
					}}
				/>,
			)
		})
	})
	plugin.registerEvent(
		plugin.app.vault.on('modify', file => {
			if (!file.path.endsWith('.events.json')) return
			refreshBlocks()
		}),
	)
	return () => {
		closeEditorBlocks()
		style.remove()
	}
}

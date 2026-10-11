import { Effect, Schema } from 'effect'
import { MarkdownRenderChild, MarkdownView, type Plugin } from 'obsidian'
import { AudioCue, parseCues } from '../domain/audio/cues'
import { runVault } from '../vault/obsidian'
import type { PlaybackEngine } from './engine'

const cueFrom = (element: Element): AudioCue | undefined => {
	if (!(element instanceof HTMLElement)) return undefined
	const file = element.dataset.file
	if (file === undefined) return undefined
	const volume = Number(element.dataset.volume)
	const crossfade = Number(element.dataset.crossfade)
	const parsed = Effect.runSync(
		Effect.either(
			Schema.decodeUnknown(AudioCue)({
				file,
				volume,
				crossfade,
				loop: element.dataset.loop === 'true',
			}),
		),
	)
	if (parsed._tag === 'Left') return undefined
	return parsed.right
}

class CueSentinels extends MarkdownRenderChild {
	constructor(
		containerEl: HTMLElement,
		private readonly observer: IntersectionObserver,
	) {
		super(containerEl)
	}

	onunload(): void {
		this.observer.disconnect()
	}
}

const previewing = (plugin: Plugin): boolean =>
	plugin.app.workspace.getLeavesOfType('markdown').some(leaf => {
		const { view } = leaf
		return view instanceof MarkdownView && view.getMode() === 'preview'
	})

export const registerReadingAudio = (
	plugin: Plugin,
	engine: PlaybackEngine,
	notice: (message: string) => void,
): (() => void) => {
	const style = document.createElement('style')
	style.textContent =
		'.writing-audio-sentinel { display: block; height: 1px; width: 100%; }'
	document.head.append(style)
	const releaseReading = (): void => {
		runVault(engine.release('reading'))
	}
	plugin.registerMarkdownPostProcessor((element, context) => {
		const info = context.getSectionInfo(element)
		if (info === null) return
		const parsed = parseCues(info.text)
		for (const error of parsed.errors) notice(error.message)
		if (parsed.cues.length === 0) return
		const sentinels = parsed.cues.map(cue => {
			const sentinel = element.createSpan({ cls: 'writing-audio-sentinel' })
			sentinel.dataset.file = cue.file
			sentinel.dataset.volume = String(cue.volume)
			sentinel.dataset.crossfade = String(cue.crossfade)
			sentinel.dataset.loop = String(cue.loop)
			return sentinel
		})
		const observer = new IntersectionObserver(
			entries => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue
					const cue = cueFrom(entry.target)
					if (cue === undefined) continue
					runVault(engine.play(cue, 'reading'))
				}
			},
			{ rootMargin: '-50% 0px -50% 0px', threshold: 0 },
		)
		for (const sentinel of sentinels) observer.observe(sentinel)
		context.addChild(new CueSentinels(element, observer))
	})
	plugin.registerEvent(
		plugin.app.workspace.on('layout-change', () => {
			if (!previewing(plugin)) releaseReading()
		}),
	)
	plugin.registerEvent(
		plugin.app.workspace.on('file-open', () => {
			releaseReading()
		}),
	)
	return () => {
		style.remove()
		releaseReading()
	}
}

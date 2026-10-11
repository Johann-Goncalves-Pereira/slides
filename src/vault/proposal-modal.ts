import { type App, Modal, Setting } from 'obsidian'
import type { StoryEvent } from '../domain/story/event'

const describeEvent = (event: StoryEvent): string => {
	if (event.type === 'STAT_CHANGE') {
		const deltas = Object.entries(event.deltas)
			.map(([stat, delta]) => `${stat} ${delta}`)
			.join(', ')
		return `STAT_CHANGE ${event.targetEntity} ${deltas}`
	}
	if (event.type === 'AFFINITY_SHIFT') {
		return `AFFINITY_SHIFT ${event.targetEntity} ${event.axis} ${event.delta} toward ${event.object}`
	}
	if (event.type === 'INVENTORY_MUTATION') {
		return `INVENTORY_MUTATION ${event.op} ${event.quantity} ${event.name} for ${event.targetEntity}`
	}
	if (event.type === 'STATUS_EFFECT') {
		const duration =
			event.durationScenes === undefined
				? ''
				: ` for ${event.durationScenes} scenes`
		return `STATUS_EFFECT ${event.op} ${event.name} on ${event.targetEntity}${duration}`
	}
	const stats = Object.entries(event.stats)
		.map(([stat, value]) => `${stat} ${value}`)
		.join(', ')
	return `OVERRIDE_SYNC ${event.targetEntity} ${stats}`
}

export class ProposalModal extends Modal {
	constructor(
		app: App,
		private readonly events: readonly StoryEvent[],
		private readonly accept: () => void,
		private readonly reject: () => void,
	) {
		super(app)
	}

	onOpen(): void {
		const { contentEl } = this
		contentEl.empty()
		contentEl.createEl('h2', { text: 'Proposed events' })
		for (const event of this.events) {
			contentEl.createEl('p', { text: describeEvent(event) })
		}
		new Setting(contentEl)
			.addButton(button => {
				button
					.setButtonText('Accept')
					.setCta()
					.onClick(() => {
						this.accept()
						this.close()
					})
				return button
			})
			.addButton(button => {
				button.setButtonText('Reject').onClick(() => {
					this.reject()
					this.close()
				})
				return button
			})
	}

	onClose(): void {
		this.contentEl.empty()
	}
}

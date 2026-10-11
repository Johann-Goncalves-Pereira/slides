import { type Extension, StateField } from '@codemirror/state'
import { ViewPlugin, type ViewUpdate } from '@codemirror/view'
import { wikilinkEdits } from '../domain/extract/beats'
import type { VaultRoots } from '../domain/vault/roots'

const targetsOf = (markdown: string, roots: VaultRoots): readonly string[] =>
	wikilinkEdits('', markdown, roots).map(edit => edit.target)

export const notifyIfLinksChanged = (
	docChanged: boolean,
	before: string,
	after: string,
	roots: VaultRoots,
	notify: (text: string) => void,
): void => {
	if (!docChanged) return
	if (wikilinkEdits(before, after, roots).length === 0) return
	notify(after)
}

export const linkTracker = (
	roots: () => VaultRoots,
	notify: (text: string) => void,
): {
	readonly field: StateField<readonly string[]>
	readonly extension: Extension
} => {
	const field = StateField.define<readonly string[]>({
		create(state) {
			return targetsOf(state.doc.toString(), roots())
		},
		update(value, transaction) {
			if (!transaction.docChanged) return value
			return targetsOf(transaction.newDoc.toString(), roots())
		},
	})
	const extension: Extension = [
		field,
		ViewPlugin.fromClass(
			class {
				update(update: ViewUpdate): void {
					notifyIfLinksChanged(
						update.docChanged,
						update.startState.doc.toString(),
						update.state.doc.toString(),
						roots(),
						notify,
					)
				}
			},
		),
	]
	return { field, extension }
}

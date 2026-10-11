import { EditorSelection, EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { defaultVaultRoots } from '../domain/vault/roots'
import { linkTracker, notifyIfLinksChanged } from './links'

describe('linkTracker', () => {
	it('records watched link targets and keeps them through a selection change', () => {
		const tracker = linkTracker(
			() => defaultVaultRoots,
			() => undefined,
		)
		const start = EditorState.create({
			doc: 'See [[Personagens/Arthur]] and [[Personagens/Arthur]] and [[Mundo/Excalibur]].',
			extensions: tracker.extension,
		})
		expect(start.field(tracker.field)).toEqual([
			'Mundo/Excalibur',
			'Personagens/Arthur',
			'Personagens/Arthur',
		])
		const selected = start.update({
			selection: EditorSelection.cursor(0),
		}).state
		expect(selected.field(tracker.field)).toBe(start.field(tracker.field))
	})

	it('reports the new note only when a watched link changes', () => {
		const reports: string[] = []
		const notify = (text: string) => {
			reports.push(text)
		}
		notifyIfLinksChanged(
			false,
			'See [[Personagens/Arthur]].',
			'See [[Mundo/Excalibur]].',
			defaultVaultRoots,
			notify,
		)
		notifyIfLinksChanged(
			true,
			'See [[Notes/Todo]].',
			'See [[Personagens/Arthur]].',
			defaultVaultRoots,
			notify,
		)
		notifyIfLinksChanged(
			true,
			'See [[Personagens/Arthur]].',
			'See [[Personagens/Arthur]]. More prose.',
			defaultVaultRoots,
			notify,
		)
		expect(reports).toEqual(['See [[Personagens/Arthur]].'])
	})
})

import { describe, expect, it } from 'vitest'
import { defaultVaultRoots } from '../vault/roots'
import { splitBeats, wikilinkEdits } from './beats'

describe('wikilinkEdits', () => {
	it('reports added and removed character and world links', () => {
		const before = 'See [[Mundo/Excalibur]] and [[Notes/Todo]].'
		const after = 'See [[Personagens/Arthur]] and [[Notes/Todo]].'
		expect(wikilinkEdits(before, after, defaultVaultRoots)).toEqual([
			{ kind: 'added', target: 'Personagens/Arthur' },
			{ kind: 'removed', target: 'Mundo/Excalibur' },
		])
	})
})

describe('splitBeats', () => {
	it('counts beats and scenes from the chapter coordinate', () => {
		const markdown = [
			'Opening',
			'---',
			'Second beat',
			'***',
			'New scene',
			'<!-- beat -->',
			'After beat tag',
		].join('\n')
		const beats = splitBeats(markdown, {
			chapterOrder: 3,
			timestamp: 40,
			branchId: 'alt',
		})
		expect(
			beats.map(beat => ({
				text: beat.text,
				sceneIndex: beat.coordinate.sceneIndex,
				beatIndex: beat.coordinate.beatIndex,
				chapterOrder: beat.coordinate.chapterOrder,
				timestamp: beat.coordinate.timestamp,
				branchId: beat.coordinate.branchId,
			})),
		).toEqual([
			{
				text: 'Opening',
				sceneIndex: 0,
				beatIndex: 0,
				chapterOrder: 3,
				timestamp: 40,
				branchId: 'alt',
			},
			{
				text: 'Second beat',
				sceneIndex: 0,
				beatIndex: 1,
				chapterOrder: 3,
				timestamp: 40,
				branchId: 'alt',
			},
			{
				text: 'New scene',
				sceneIndex: 1,
				beatIndex: 0,
				chapterOrder: 3,
				timestamp: 40,
				branchId: 'alt',
			},
			{
				text: 'After beat tag',
				sceneIndex: 1,
				beatIndex: 1,
				chapterOrder: 3,
				timestamp: 40,
				branchId: 'alt',
			},
		])
	})
})

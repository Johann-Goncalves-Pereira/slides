import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import {
	decodePluginSettings,
	decodeVaultRoots,
	defaultPluginSettings,
	defaultVaultRoots,
} from './roots'

describe('decodeVaultRoots', () => {
	it('fills the four defaults when data is missing', async () => {
		const roots = await Effect.runPromise(decodeVaultRoots({}))
		expect(roots).toEqual(defaultVaultRoots)
		expect(roots).toEqual({
			livro: 'Livro',
			personagens: 'Personagens',
			mundo: 'Mundo',
			assets: 'Assets',
		})
	})

	it('keeps a provided root and fills the rest', async () => {
		const roots = await Effect.runPromise(
			decodeVaultRoots({ livro: 'Manuscript' }),
		)
		expect(roots.livro).toBe('Manuscript')
		expect(roots.personagens).toBe('Personagens')
		expect(roots.mundo).toBe('Mundo')
		expect(roots.assets).toBe('Assets')
	})
})

describe('decodePluginSettings', () => {
	it('fills the model defaults beside the vault roots', async () => {
		const settings = await Effect.runPromise(decodePluginSettings({}))
		expect(settings).toEqual(defaultPluginSettings)
		expect(settings).toEqual({
			livro: 'Livro',
			personagens: 'Personagens',
			mundo: 'Mundo',
			assets: 'Assets',
			modelBaseUrl: 'http://127.0.0.1:11434',
			modelName: 'qwen2.5:1.5b',
			pauseMillis: 30_000,
		})
	})
})

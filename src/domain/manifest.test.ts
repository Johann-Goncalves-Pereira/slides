import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { decodeManifest, runLoad } from './manifest'

const validManifest = {
	id: 'slides',
	name: 'Slides',
	version: '1.0.0',
	minAppVersion: '1.0.0',
	description: 'Obsidian plugin shell.',
	isDesktopOnly: false,
}

describe('decodeManifest', () => {
	it('decodes a valid manifest', async () => {
		const manifest = await Effect.runPromise(decodeManifest(validManifest))
		expect(manifest.id).toBe('slides')
		expect(manifest.name).toBe('Slides')
	})

	it('rejects an empty id', async () => {
		const result = await Effect.runPromise(
			Effect.either(decodeManifest({ ...validManifest, id: '' })),
		)
		expect(result._tag).toBe('Left')
	})
})

describe('runLoad', () => {
	it('decodes the plugin manifest', async () => {
		const manifest = await Effect.runPromise(runLoad())
		expect(manifest.id).toBe('slides')
	})
})

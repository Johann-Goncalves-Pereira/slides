import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { decodeManifest, runLoad } from './manifest'

const validManifest = {
	id: 'writing',
	name: 'Writing',
	version: '1.0.0',
	minAppVersion: '1.0.0',
	description: 'Event-sourced canon for novels and LitRPG.',
	isDesktopOnly: false,
}

describe('decodeManifest', () => {
	it('decodes a valid manifest', async () => {
		const manifest = await Effect.runPromise(decodeManifest(validManifest))
		expect(manifest.id).toBe('writing')
		expect(manifest.name).toBe('Writing')
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
		expect(manifest.id).toBe('writing')
		expect(manifest.name).toBe('Writing')
		expect(manifest.description).toBe(
			'Event-sourced canon for novels and LitRPG.',
		)
	})
})

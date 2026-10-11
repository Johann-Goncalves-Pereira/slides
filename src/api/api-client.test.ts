import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { ollamaModel } from './api-client'

describe('ollamaModel', () => {
	it('posts a json schema chat request and reads message content', async () => {
		const calls: Array<{ url: string; body: unknown }> = []
		const original = globalThis.fetch
		globalThis.fetch = (input, init) => {
			const url = input instanceof Request ? input.url : String(input)
			const raw = init?.body
			const body: unknown =
				typeof raw === 'string' ? JSON.parse(raw) : undefined
			calls.push({ url, body })
			return Promise.resolve(
				new Response(
					JSON.stringify({
						message: { content: '{"events":[]}' },
					}),
					{ status: 200 },
				),
			)
		}
		try {
			const result = await Effect.runPromise(
				ollamaModel({
					modelBaseUrl: 'http://127.0.0.1:11434',
					modelName: 'qwen2.5:1.5b',
				}).propose('chapter text'),
			)
			expect(result).toEqual({ events: [] })
			expect(calls[0]?.url).toBe('http://127.0.0.1:11434/api/chat')
			expect(calls[0]?.body).toMatchObject({
				model: 'qwen2.5:1.5b',
				stream: false,
				messages: [
					{ role: 'system' },
					{ role: 'user', content: 'chapter text' },
				],
				format: { type: 'object' },
			})
		} finally {
			globalThis.fetch = original
		}
	})

	it('fails when the model content is not json', async () => {
		const original = globalThis.fetch
		globalThis.fetch = () =>
			Promise.resolve(
				new Response(JSON.stringify({ message: { content: 'not-json' } }), {
					status: 200,
				}),
			)
		try {
			const result = await Effect.runPromise(
				Effect.either(
					ollamaModel({
						modelBaseUrl: 'http://127.0.0.1:11434',
						modelName: 'qwen2.5:1.5b',
					}).propose('chapter text'),
				),
			)
			expect(result._tag).toBe('Left')
		} finally {
			globalThis.fetch = original
		}
	})
})

import { Effect, Schema } from 'effect'
import { ModelError } from '../domain/extract/model'

const systemPrompt = [
	'Propose atomic story events for the chapter.',
	'Use only STAT_CHANGE, AFFINITY_SHIFT, INVENTORY_MUTATION, and STATUS_EFFECT.',
	'Do not emit OVERRIDE_SYNC.',
	'Affinity may use targetEntity "Arthur->Merlin" and payload {"trust": -5}.',
	'Return JSON with an events array.',
].join(' ')

const proposalFormat = {
	type: 'object',
	properties: {
		events: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					type: {
						type: 'string',
						enum: [
							'STAT_CHANGE',
							'AFFINITY_SHIFT',
							'INVENTORY_MUTATION',
							'STATUS_EFFECT',
						],
					},
					targetEntity: { type: 'string' },
					eventId: { type: 'string' },
					deltas: { type: 'object' },
					payload: { type: 'object' },
					object: { type: 'string' },
					axis: { type: 'string' },
					delta: { type: 'number' },
					op: { type: 'string' },
					itemId: { type: 'string' },
					name: { type: 'string' },
					quantity: { type: 'integer' },
					durationScenes: { type: 'integer' },
				},
				required: ['type', 'targetEntity'],
			},
		},
	},
	required: ['events'],
} as const

const ChatResponse = Schema.Struct({
	message: Schema.Struct({
		content: Schema.String,
	}),
})

export type ModelTarget = {
	readonly modelBaseUrl: string
	readonly modelName: string
}

export const ollamaModel = (target: ModelTarget) => ({
	propose: (prompt: string) =>
		Effect.gen(function* () {
			const endpoint = yield* Effect.try({
				try: () => new URL('/api/chat', target.modelBaseUrl),
				catch: () =>
					new ModelError({ message: 'The model base URL is invalid.' }),
			})
			const response = yield* Effect.tryPromise({
				try: () =>
					fetch(endpoint, {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({
							model: target.modelName,
							stream: false,
							messages: [
								{ role: 'system', content: systemPrompt },
								{ role: 'user', content: prompt },
							],
							format: proposalFormat,
						}),
					}),
				catch: () => new ModelError({ message: 'Could not reach the model.' }),
			})
			if (!response.ok) {
				return yield* Effect.fail(
					new ModelError({
						message: `The model request failed (${response.status}).`,
					}),
				)
			}
			const body: unknown = yield* Effect.tryPromise({
				try: () => response.json(),
				catch: () =>
					new ModelError({
						message: 'The model response was not JSON.',
					}),
			})
			const chat = yield* Schema.decodeUnknown(ChatResponse)(body).pipe(
				Effect.mapError(
					() =>
						new ModelError({
							message: 'The model response was missing message content.',
						}),
				),
			)
			return yield* Effect.try({
				try: () => {
					const parsed: unknown = JSON.parse(chat.message.content)
					return parsed
				},
				catch: () =>
					new ModelError({
						message: 'The model returned malformed JSON.',
					}),
			})
		}),
})

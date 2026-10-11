import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { applyProposal, decodeProposal } from './proposal'

const coordinate = {
	branchId: 'main',
	chapterOrder: 1,
	sceneIndex: 0,
	beatIndex: 2,
	timestamp: 10,
}

const kept = {
	eventId: 'evt-keep',
	targetEntity: 'Arthur',
	coordinate,
	type: 'STAT_CHANGE' as const,
	deltas: { HP: -20 },
}

describe('decodeProposal', () => {
	it('maps an affinity arrow into subject, object, axis, and delta', async () => {
		const events = await Effect.runPromise(
			decodeProposal(
				{
					events: [
						{
							type: 'AFFINITY_SHIFT',
							targetEntity: 'Arthur->Merlin',
							payload: { trust: -5 },
						},
					],
				},
				coordinate,
				[],
			),
		)
		expect(events).toEqual([
			{
				eventId: 'extract:0',
				targetEntity: 'Arthur',
				object: 'Merlin',
				axis: 'trust',
				delta: -5,
				type: 'AFFINITY_SHIFT',
				coordinate,
			},
		])
	})

	it('keeps a structured stat change', async () => {
		const events = await Effect.runPromise(
			decodeProposal(
				{
					events: [
						{
							eventId: 'evt-hp',
							type: 'STAT_CHANGE',
							targetEntity: 'Arthur',
							deltas: { HP: 10 },
						},
					],
				},
				coordinate,
				[],
			),
		)
		expect(events[0]).toMatchObject({
			eventId: 'evt-hp',
			type: 'STAT_CHANGE',
			targetEntity: 'Arthur',
			deltas: { HP: 10 },
			coordinate,
		})
	})

	it('rejects an override, an unknown type, and a duplicate event id', async () => {
		const rejected = [
			{
				events: [
					{ type: 'OVERRIDE_SYNC', targetEntity: 'Arthur', stats: { HP: 1 } },
				],
			},
			{ events: [{ type: 'LEVEL_UP', targetEntity: 'Arthur' }] },
			{
				events: [
					{
						eventId: 'evt-keep',
						type: 'STAT_CHANGE',
						targetEntity: 'Arthur',
						deltas: { HP: 1 },
					},
				],
			},
		]
		for (const input of rejected) {
			const result = await Effect.runPromise(
				Effect.either(decodeProposal(input, coordinate, ['evt-keep'])),
			)
			expect(result._tag).toBe('Left')
		}
	})
})

describe('applyProposal', () => {
	it('leaves the sidecar event ids unchanged when decoding fails', async () => {
		const sidecar = {
			noteId: 'note-cap1',
			tombstoned: false,
			events: [kept],
		}
		const result = await Effect.runPromise(
			Effect.either(
				applyProposal(
					sidecar,
					{ events: [{ type: 'LEVEL_UP', targetEntity: 'Arthur' }] },
					coordinate,
				),
			),
		)
		expect(result._tag).toBe('Left')
		expect(sidecar.events.map(event => event.eventId)).toEqual(['evt-keep'])
	})
})

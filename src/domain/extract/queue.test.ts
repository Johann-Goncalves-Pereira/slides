import {
	Deferred,
	Duration,
	Effect,
	Exit,
	Scope,
	TestClock,
	TestContext,
} from 'effect'
import { describe, expect, it } from 'vitest'
import type { EventSidecar } from '../vault/frontmatter'
import { ModelClient } from './model'
import { makeExtractionQueue } from './queue'

const coordinate = {
	branchId: 'main',
	chapterOrder: 1,
	sceneIndex: 0,
	beatIndex: 0,
	timestamp: 10,
}

const kept = {
	eventId: 'evt-keep',
	targetEntity: 'Arthur',
	coordinate,
	type: 'STAT_CHANGE' as const,
	deltas: { HP: -20 },
}

const request = (text: string) => ({
	chapterPath: 'Livro/Cap1.md',
	noteId: 'note-cap1',
	text,
	coordinate,
	pauseMillis: 30_000,
})

describe('ExtractionQueue', () => {
	it('calls the model once with the latest text after the pause', async () => {
		const calls: string[] = []
		await Effect.runPromise(
			Effect.gen(function* () {
				const gate = yield* Deferred.make<void>()
				const scope = yield* Scope.make()
				const queue = yield* makeExtractionQueue(scope, {
					readSidecar: () =>
						Effect.succeed({
							noteId: 'note-cap1',
							tombstoned: false,
							events: [],
						}),
					writeSidecar: () => Effect.void,
					notice: () => undefined,
					onProposal: () => undefined,
				})
				yield* Effect.provideService(
					queue.enqueue(request('first draft')),
					ModelClient,
					{
						propose: text =>
							Effect.gen(function* () {
								calls.push(text)
								yield* Deferred.await(gate)
								return { events: [] }
							}),
					},
				)
				yield* Effect.provideService(
					queue.enqueue(request('second draft')),
					ModelClient,
					{
						propose: text =>
							Effect.gen(function* () {
								calls.push(text)
								yield* Deferred.await(gate)
								return { events: [] }
							}),
					},
				)
				expect(calls).toEqual([])
				yield* TestClock.adjust(Duration.millis(30_000))
				expect(calls).toEqual(['second draft'])
				yield* Deferred.succeed(gate, undefined)
				yield* Scope.close(scope, Exit.void)
			}).pipe(Effect.provide(TestContext.TestContext)),
		)
	})

	it('appends on accept and writes nothing on reject or a second accept', async () => {
		let sidecar: EventSidecar = {
			noteId: 'note-cap1',
			tombstoned: false,
			events: [kept],
		}
		const writes: EventSidecar[] = []
		const proposal = {
			events: [
				{
					eventId: 'evt-new',
					type: 'STAT_CHANGE',
					targetEntity: 'Arthur',
					deltas: { HP: 1 },
				},
			],
		}
		await Effect.runPromise(
			Effect.gen(function* () {
				const scope = yield* Scope.make()
				const queue = yield* makeExtractionQueue(scope, {
					readSidecar: () => Effect.succeed(sidecar),
					writeSidecar: (_path, next) =>
						Effect.sync(() => {
							writes.push(next)
							sidecar = next
						}),
					notice: () => undefined,
					onProposal: () => undefined,
				})
				const model = {
					propose: () => Effect.succeed(proposal),
				}
				yield* queue
					.enqueue(request('chapter'))
					.pipe(Effect.provideService(ModelClient, model))
				yield* TestClock.adjust(Duration.millis(30_000))
				yield* queue.acceptProposal('Livro/Cap1.md')
				yield* queue.acceptProposal('Livro/Cap1.md')
				expect(writes).toHaveLength(1)
				expect(sidecar.events.map(event => event.eventId)).toEqual([
					'evt-keep',
					'evt-new',
				])

				sidecar = {
					noteId: 'note-cap1',
					tombstoned: false,
					events: [kept],
				}
				writes.length = 0
				yield* queue
					.enqueue(request('chapter'))
					.pipe(Effect.provideService(ModelClient, model))
				yield* TestClock.adjust(Duration.millis(30_000))
				yield* queue.rejectProposal('Livro/Cap1.md')
				expect(writes).toHaveLength(0)
				expect(sidecar.events.map(event => event.eventId)).toEqual(['evt-keep'])
				yield* Scope.close(scope, Exit.void)
			}).pipe(Effect.provide(TestContext.TestContext)),
		)
	})
})

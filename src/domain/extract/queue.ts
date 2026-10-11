import { Duration, Effect, Fiber, type Scope } from 'effect'
import type { StoryCoordinate } from '../story/coordinate'
import type { StoryEvent } from '../story/event'
import type { EventSidecar } from '../vault/frontmatter'
import { ModelClient } from './model'
import { decodeProposal, ExtractionError } from './proposal'

export type ExtractionRequest = {
	readonly chapterPath: string
	readonly noteId: string
	readonly text: string
	readonly coordinate: StoryCoordinate
	readonly pauseMillis: number
}

export type ExtractionStore = {
	readonly readSidecar: (
		path: string,
	) => Effect.Effect<EventSidecar, ExtractionError>
	readonly writeSidecar: (
		path: string,
		sidecar: EventSidecar,
	) => Effect.Effect<void, ExtractionError>
	readonly notice: (message: string) => void
	readonly onProposal: (path: string, events: readonly StoryEvent[]) => void
}

export type ExtractionQueue = {
	readonly enqueue: (
		request: ExtractionRequest,
	) => Effect.Effect<void, never, ModelClient>
	readonly acceptProposal: (
		path: string,
	) => Effect.Effect<void, ExtractionError>
	readonly rejectProposal: (path: string) => Effect.Effect<void>
}

export const makeExtractionQueue = (
	scope: Scope.Scope,
	store: ExtractionStore,
): Effect.Effect<ExtractionQueue> =>
	Effect.sync(() => {
		const latest = new Map<string, ExtractionRequest>()
		const fibers = new Map<string, Fiber.RuntimeFiber<void, never>>()
		const pending = new Map<string, readonly StoryEvent[]>()

		const worker = (request: ExtractionRequest) =>
			Effect.gen(function* () {
				yield* Effect.sleep(Duration.millis(request.pauseMillis))
				if (latest.get(request.chapterPath) !== request) return
				const model = yield* ModelClient
				const output = yield* model.propose(request.text)
				if (latest.get(request.chapterPath) !== request) return
				const sidecar = yield* store.readSidecar(request.chapterPath)
				const events = yield* decodeProposal(
					output,
					request.coordinate,
					sidecar.events.map(event => event.eventId),
				)
				if (latest.get(request.chapterPath) !== request) return
				if (events.length === 0) {
					store.notice('The model proposed no events.')
					return
				}
				pending.set(request.chapterPath, events)
				store.onProposal(request.chapterPath, events)
			}).pipe(
				Effect.catchAll(error =>
					Effect.sync(() => {
						store.notice(error.message)
					}),
				),
			)

		const enqueue: ExtractionQueue['enqueue'] = request =>
			Effect.gen(function* () {
				latest.set(request.chapterPath, request)
				const previous = fibers.get(request.chapterPath)
				if (previous !== undefined) yield* Fiber.interrupt(previous)
				const fiber = yield* Effect.forkIn(worker(request), scope)
				fibers.set(request.chapterPath, fiber)
			})

		const acceptProposal: ExtractionQueue['acceptProposal'] = path =>
			Effect.gen(function* () {
				const events = pending.get(path)
				if (events === undefined) return
				const sidecar = yield* store.readSidecar(path)
				const seen = new Set(sidecar.events.map(event => event.eventId))
				for (const event of events) {
					if (seen.has(event.eventId)) {
						return yield* Effect.fail(
							new ExtractionError({
								message: `Duplicate event id ${event.eventId}.`,
							}),
						)
					}
				}
				yield* store.writeSidecar(path, {
					...sidecar,
					events: [...sidecar.events, ...events],
				})
				pending.delete(path)
			})

		const rejectProposal: ExtractionQueue['rejectProposal'] = path =>
			Effect.sync(() => {
				pending.delete(path)
			})

		return { enqueue, acceptProposal, rejectProposal }
	})

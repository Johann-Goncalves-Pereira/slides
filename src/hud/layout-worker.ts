import { Effect, Schema } from 'effect'
import { type HudGraph, layoutGraph } from '../domain/hud/graph'
import { RehydrationError } from '../domain/story/errors'

const LayoutReply = Schema.Struct({
	requestId: Schema.Finite,
	positions: Schema.Array(
		Schema.Struct({
			id: Schema.NonEmptyString,
			x: Schema.Finite,
			y: Schema.Finite,
		}),
	),
})

export type LayoutPort = {
	readonly layout: (
		graph: HudGraph,
	) => Effect.Effect<
		readonly { readonly id: string; readonly x: number; readonly y: number }[],
		RehydrationError
	>
	readonly terminate: () => void
}

const workerSource = (): string => {
	const layout = layoutGraph.toString()
	return `
		const layoutGraph = ${layout}
		self.onmessage = (event) => {
			const requestId = event.data && event.data.requestId
			const graph = event.data && event.data.graph
			const positions = layoutGraph(graph)
			self.postMessage({ requestId, positions })
		}
	`
}

export const createLayoutWorker = (): LayoutPort => {
	const url = URL.createObjectURL(
		new Blob([workerSource()], { type: 'application/javascript' }),
	)
	const worker = new Worker(url)
	let nextId = 0
	const layout: LayoutPort['layout'] = graph =>
		Effect.async(resume => {
			const requestId = nextId
			nextId += 1
			const onMessage = (event: MessageEvent): void => {
				const raw: unknown = event.data
				const decoded = Effect.runSync(
					Effect.either(Schema.decodeUnknown(LayoutReply)(raw)),
				)
				if (decoded._tag === 'Left') {
					worker.removeEventListener('message', onMessage)
					resume(
						Effect.fail(
							new RehydrationError({
								message: 'Could not lay out the graph.',
							}),
						),
					)
					return
				}
				if (decoded.right.requestId !== requestId) return
				worker.removeEventListener('message', onMessage)
				resume(Effect.succeed(decoded.right.positions))
			}
			worker.addEventListener('message', onMessage)
			worker.postMessage({ requestId, graph })
			return Effect.sync(() => {
				worker.removeEventListener('message', onMessage)
			})
		})
	return {
		layout,
		terminate: () => {
			worker.terminate()
			URL.revokeObjectURL(url)
		},
	}
}

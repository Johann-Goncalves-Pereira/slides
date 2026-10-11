import { Effect, type ParseResult, Schema } from 'effect'
import { decodeWorldState } from '../story/state'

export const HudNode = Schema.Struct({
	id: Schema.NonEmptyString,
	kind: Schema.Literal('character', 'item', 'object'),
	label: Schema.NonEmptyString,
})

export type HudNode = typeof HudNode.Type

const AffinityEdge = Schema.Struct({
	id: Schema.NonEmptyString,
	source: Schema.NonEmptyString,
	target: Schema.NonEmptyString,
	kind: Schema.Literal('affinity'),
	axis: Schema.NonEmptyString,
	score: Schema.Finite,
})

const HoldsEdge = Schema.Struct({
	id: Schema.NonEmptyString,
	source: Schema.NonEmptyString,
	target: Schema.NonEmptyString,
	kind: Schema.Literal('holds'),
	quantity: Schema.Int.pipe(Schema.positive()),
})

export const HudEdge = Schema.Union(AffinityEdge, HoldsEdge)

export type HudEdge = typeof HudEdge.Type

export const HudGraph = Schema.Struct({
	nodes: Schema.Array(HudNode),
	edges: Schema.Array(HudEdge),
})

export type HudGraph = typeof HudGraph.Type

export const decodeHudGraph = Schema.decodeUnknown(HudGraph)

const byId = (
	left: { readonly id: string },
	right: { readonly id: string },
) => {
	if (left.id < right.id) return -1
	if (left.id > right.id) return 1
	return 0
}

export const projectGraph = (
	world: unknown,
): Effect.Effect<HudGraph, ParseResult.ParseError> =>
	Effect.gen(function* () {
		const decoded = yield* decodeWorldState(world)
		const characters = Object.values(decoded.characters)
		const characterIds = new Set(
			characters.map(character => character.characterId),
		)
		const characterByName = new Map(
			characters.map(character => [character.name, character.characterId]),
		)
		const nodes = new Map<string, HudNode>()
		const edges: HudEdge[] = []
		const targetFor = (object: string): string => {
			if (characterIds.has(object)) return `character:${object}`
			const named = characterByName.get(object)
			if (named !== undefined) return `character:${named}`
			const id = `object:${object}`
			nodes.set(id, { id, kind: 'object', label: object })
			return id
		}
		for (const character of characters) {
			const source = `character:${character.characterId}`
			nodes.set(source, {
				id: source,
				kind: 'character',
				label: character.name,
			})
			for (const affinity of character.affinities) {
				const target = targetFor(affinity.object)
				edges.push({
					id: `affinity:${character.characterId}:${affinity.object}:${affinity.axis}`,
					source,
					target,
					kind: 'affinity',
					axis: affinity.axis,
					score: affinity.score,
				})
			}
			for (const item of character.inventory) {
				const target = `item:${item.itemId}`
				if (!nodes.has(target)) {
					nodes.set(target, { id: target, kind: 'item', label: item.name })
				}
				edges.push({
					id: `holds:${character.characterId}:${item.itemId}`,
					source,
					target,
					kind: 'holds',
					quantity: item.quantity,
				})
			}
		}
		return yield* decodeHudGraph({
			nodes: [...nodes.values()].sort(byId),
			edges: edges.sort(byId),
		})
	})

export const affinityTone = (
	score: number,
): { readonly color: string; readonly motion: string } => {
	if (score > 0) return { color: '#00E5FF', motion: 'approach' }
	if (score < 0) return { color: '#A855F7', motion: 'recede' }
	return { color: '#D4AF37', motion: 'still' }
}

export type GraphPosition = {
	readonly id: string
	readonly x: number
	readonly y: number
}

export const layoutGraph = (graph: {
	readonly nodes: readonly { readonly id: string }[]
}): readonly GraphPosition[] => {
	const nodes = [...graph.nodes].sort((left, right) => {
		if (left.id < right.id) return -1
		if (left.id > right.id) return 1
		return 0
	})
	const radius = 200
	if (nodes.length === 0) return []
	return nodes.map((node, index) => {
		const angle = (index / nodes.length) * 2 * Math.PI
		return {
			id: node.id,
			x: Math.round(Math.cos(angle) * radius),
			y: Math.round(Math.sin(angle) * radius),
		}
	})
}

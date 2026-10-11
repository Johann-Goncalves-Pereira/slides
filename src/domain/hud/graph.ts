import { Effect, type ParseResult, Schema } from 'effect'
import {
	type CharacterState,
	decodeWorldState,
	type WorldEntity,
	type WorldState,
} from '../story/state'

export const HudNode = Schema.Struct({
	id: Schema.NonEmptyString,
	kind: Schema.Literal(
		'character',
		'item',
		'object',
		'faction',
		'artifact',
		'region',
		'spell',
		'lore',
	),
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

const MemberEdge = Schema.Struct({
	id: Schema.NonEmptyString,
	source: Schema.NonEmptyString,
	target: Schema.NonEmptyString,
	kind: Schema.Literal('member'),
})

const PresentEdge = Schema.Struct({
	id: Schema.NonEmptyString,
	source: Schema.NonEmptyString,
	target: Schema.NonEmptyString,
	kind: Schema.Literal('present'),
})

export const HudEdge = Schema.Union(
	AffinityEdge,
	HoldsEdge,
	MemberEdge,
	PresentEdge,
)

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

type GraphDraft = {
	readonly nodes: Map<string, HudNode>
	readonly edges: HudEdge[]
}

const rememberEntity = (
	draft: GraphDraft,
	entities: WorldState['entities'],
	named: ReadonlyMap<string, WorldEntity>,
	entityId: string,
): string | undefined => {
	const entity = entities[entityId] ?? named.get(entityId)
	if (entity === undefined) return undefined
	const id = `${entity.kind}:${entity.entityId}`
	draft.nodes.set(id, { id, kind: entity.kind, label: entity.name })
	return id
}

const targetFor = (
	draft: GraphDraft,
	world: WorldState,
	characterIds: ReadonlySet<string>,
	characterByName: ReadonlyMap<string, string>,
	named: ReadonlyMap<string, WorldEntity>,
	object: string,
): string => {
	if (characterIds.has(object)) return `character:${object}`
	const characterId = characterByName.get(object)
	if (characterId !== undefined) return `character:${characterId}`
	const entity = rememberEntity(draft, world.entities, named, object)
	if (entity !== undefined) return entity
	const id = `object:${object}`
	draft.nodes.set(id, { id, kind: 'object', label: object })
	return id
}

const linkCharacter = (
	draft: GraphDraft,
	world: WorldState,
	characterIds: ReadonlySet<string>,
	characterByName: ReadonlyMap<string, string>,
	named: ReadonlyMap<string, WorldEntity>,
	character: CharacterState,
): void => {
	const source = `character:${character.characterId}`
	draft.nodes.set(source, {
		id: source,
		kind: 'character',
		label: character.name,
	})
	for (const affinity of character.affinities) {
		draft.edges.push({
			id: `affinity:${character.characterId}:${affinity.object}:${affinity.axis}`,
			source,
			target: targetFor(
				draft,
				world,
				characterIds,
				characterByName,
				named,
				affinity.object,
			),
			kind: 'affinity',
			axis: affinity.axis,
			score: affinity.score,
		})
	}
	for (const item of character.inventory) {
		const artifact = rememberEntity(draft, world.entities, named, item.itemId)
		const target = artifact ?? `item:${item.itemId}`
		if (artifact === undefined && !draft.nodes.has(target)) {
			draft.nodes.set(target, { id: target, kind: 'item', label: item.name })
		}
		draft.edges.push({
			id: `holds:${character.characterId}:${item.itemId}`,
			source,
			target,
			kind: 'holds',
			quantity: item.quantity,
		})
	}
	for (const factionId of character.factions) {
		const faction = world.entities[factionId]
		if (faction?.kind !== 'faction') continue
		const target = rememberEntity(
			draft,
			world.entities,
			named,
			faction.entityId,
		)
		if (target === undefined) continue
		draft.edges.push({
			id: `member:${character.characterId}:${faction.entityId}`,
			source,
			target,
			kind: 'member',
		})
	}
	const region =
		character.location === undefined
			? undefined
			: world.entities[character.location]
	if (region?.kind !== 'region') return
	const target = rememberEntity(draft, world.entities, named, region.entityId)
	if (target === undefined) return
	draft.edges.push({
		id: `present:${character.characterId}:${region.entityId}`,
		source,
		target,
		kind: 'present',
	})
}

export const projectGraph = (
	world: unknown,
): Effect.Effect<HudGraph, ParseResult.ParseError> =>
	Effect.gen(function* () {
		const decoded = yield* decodeWorldState(world)
		const characters = Object.values(decoded.characters)
		const named = new Map(
			Object.values(decoded.entities).map(entity => [entity.name, entity]),
		)
		const draft: GraphDraft = { nodes: new Map(), edges: [] }
		const characterIds = new Set(
			characters.map(character => character.characterId),
		)
		const characterByName = new Map(
			characters.map(character => [character.name, character.characterId]),
		)
		for (const character of characters) {
			linkCharacter(
				draft,
				decoded,
				characterIds,
				characterByName,
				named,
				character,
			)
		}
		return yield* decodeHudGraph({
			nodes: [...draft.nodes.values()].sort(byId),
			edges: draft.edges.sort(byId),
		})
	})

export const affinityTone = (
	score: number,
): { readonly color: string; readonly motion: string } => {
	if (score >= 50) return { color: '#22C55E', motion: 'approach' }
	if (score <= -50) return { color: '#EF4444', motion: 'recede' }
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
	readonly nodes: readonly { readonly id: string; readonly kind?: string }[]
}): readonly GraphPosition[] => {
	const nodes = [...graph.nodes].sort((left, right) => {
		if (left.id < right.id) return -1
		if (left.id > right.id) return 1
		return 0
	})
	const columns = new Map<number, readonly { readonly id: string }[]>()
	for (const node of nodes) {
		const x =
			node.kind === 'character'
				? 0
				: node.kind === 'faction' || node.kind === 'region'
					? 280
					: 560
		const column = columns.get(x) ?? []
		columns.set(x, [...column, node])
	}
	const positions: GraphPosition[] = []
	for (const [x, column] of columns) {
		for (const [index, node] of column.entries()) {
			positions.push({ id: node.id, x, y: index * 120 })
		}
	}
	return positions.sort((left, right) => {
		if (left.id < right.id) return -1
		if (left.id > right.id) return 1
		return 0
	})
}

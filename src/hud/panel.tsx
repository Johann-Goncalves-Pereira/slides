import { type Edge, type Node, ReactFlow } from '@xyflow/react'
import { Effect } from 'effect'
import { type ChangeEvent, useEffect, useState } from 'react'
import { affinityTone, type HudGraph } from '../domain/hud/graph'
import { projectSheet } from '../domain/hud/stops'
import type { StoryCoordinate } from '../domain/story/coordinate'
import type { WorldState } from '../domain/story/state'

export type HudSnapshot = {
	readonly world: WorldState
	readonly graph: HudGraph
	readonly positions: readonly {
		readonly id: string
		readonly x: number
		readonly y: number
	}[]
}

export type HudActions = {
	readonly branches: () => readonly string[]
	readonly stops: (branchId: string) => readonly StoryCoordinate[]
	readonly loadAt: (
		coordinate: StoryCoordinate,
	) => Effect.Effect<HudSnapshot, { readonly message: string }>
	readonly notice: (message: string) => void
}

const sortedStats = (stats: {
	readonly [stat: string]: number
}): readonly [string, number][] =>
	Object.entries(stats).sort((left, right) => {
		if (left[0] < right[0]) return -1
		if (left[0] > right[0]) return 1
		return 0
	})

const Radar = ({
	stats,
}: {
	readonly stats: { readonly [stat: string]: number }
}) => {
	const entries = sortedStats(stats)
	if (entries.length === 0) return null
	const max = Math.max(...entries.map(([, value]) => Math.abs(value)), 1)
	const points = entries
		.map(([, value], index) => {
			const angle = (index / entries.length) * 2 * Math.PI - Math.PI / 2
			const radius = (Math.abs(value) / max) * 36
			const x = 50 + Math.cos(angle) * radius
			const y = 50 + Math.sin(angle) * radius
			return `${x},${y}`
		})
		.join(' ')
	return (
		<svg
			className='writing-radar'
			viewBox='0 0 100 100'
			role='img'
			aria-label='Character stats'
		>
			<title>Character stats</title>
			<polygon
				points={points}
				fill='#00E5FF'
				fillOpacity='0.25'
				stroke='#00E5FF'
			/>
			{entries.map(([stat], index) => {
				const angle = (index / entries.length) * 2 * Math.PI - Math.PI / 2
				const x = 50 + Math.cos(angle) * 46
				const y = 50 + Math.sin(angle) * 46
				return (
					<text key={stat} x={x} y={y} textAnchor='middle' fill='#D4AF37'>
						{stat}
					</text>
				)
			})}
		</svg>
	)
}

const GraphView = ({
	snapshot,
	selectedId,
	onSelect,
}: {
	readonly snapshot: HudSnapshot
	readonly selectedId: string | undefined
	readonly onSelect: (nodeId: string) => void
}) => {
	const nodes: Node[] = snapshot.positions.flatMap(position => {
		const hud = snapshot.graph.nodes.find(node => node.id === position.id)
		if (hud === undefined) return []
		const selected = hud.id === selectedId
		return [
			{
				id: hud.id,
				position: { x: position.x, y: position.y },
				data: { label: hud.label },
				style: {
					background: '#1E1611',
					color: '#D4AF37',
					border: selected ? '1px solid #00E5FF' : '1px solid #D4AF37',
				},
			},
		]
	})
	const edges: Edge[] = snapshot.graph.edges.map(edge => {
		if (edge.kind === 'affinity') {
			const tone = affinityTone(edge.score)
			return {
				id: edge.id,
				source: edge.source,
				target: edge.target,
				label: `${edge.axis} ${edge.score}`,
				animated: tone.motion !== 'still',
				style: { stroke: tone.color },
			}
		}
		return {
			id: edge.id,
			source: edge.source,
			target: edge.target,
			label: `holds ${edge.quantity}`,
			style: { stroke: '#D4AF37' },
		}
	})
	return (
		<div className='writing-graph'>
			<ReactFlow
				nodes={nodes}
				edges={edges}
				onNodeClick={(_event, node) => {
					onSelect(node.id)
				}}
				nodesDraggable={false}
				nodesConnectable={false}
				fitView
				colorMode='dark'
			/>
		</div>
	)
}

export const HudPanel = ({
	actions,
	revision,
}: {
	readonly actions: HudActions
	readonly revision: number
}) => {
	const branches = actions.branches()
	const [branchId, setBranchId] = useState(branches[0] ?? 'main')
	const [index, setIndex] = useState(0)
	const [characterId, setCharacterId] = useState<string | undefined>(undefined)
	const [snapshot, setSnapshot] = useState<HudSnapshot | undefined>(undefined)
	const activeBranch = branches.includes(branchId)
		? branchId
		: (branches[0] ?? 'main')
	const stops = actions.stops(activeBranch)
	const safeIndex = Math.min(index, Math.max(stops.length - 1, 0))
	const stop = stops[safeIndex]

	useEffect(() => {
		const currentStops = actions.stops(activeBranch)
		const currentIndex = Math.min(index, Math.max(currentStops.length - 1, 0))
		const currentStop = currentStops[currentIndex]
		if (currentStop === undefined) return
		const seenRevision = revision
		let current = true
		void Effect.runPromise(actions.loadAt(currentStop))
			.then(loaded => {
				if (!current || seenRevision !== revision) return
				setSnapshot(loaded)
				setCharacterId(previous => {
					if (
						previous !== undefined &&
						loaded.world.characters[previous] !== undefined
					) {
						return previous
					}
					const ids = Object.keys(loaded.world.characters).sort()
					return ids[0]
				})
			})
			.catch((cause: unknown) => {
				if (!current || seenRevision !== revision) return
				const message =
					typeof cause === 'object' &&
					cause !== null &&
					'message' in cause &&
					typeof cause.message === 'string'
						? cause.message
						: 'Could not read the story at this coordinate.'
				actions.notice(message)
			})
		return () => {
			current = false
		}
	}, [actions, activeBranch, index, revision])

	const sheetResult =
		snapshot === undefined || characterId === undefined
			? undefined
			: Effect.runSync(Effect.either(projectSheet(snapshot.world, characterId)))
	const sheet = sheetResult?._tag === 'Right' ? sheetResult.right : undefined
	const selectedId =
		characterId === undefined ? undefined : `character:${characterId}`

	return (
		<div className='writing-hud'>
			<h2>Canon</h2>
			<label>
				Branch
				<select
					value={activeBranch}
					onChange={(event: ChangeEvent<HTMLSelectElement>) => {
						setBranchId(event.target.value)
						setIndex(0)
					}}
				>
					{branches.map(branch => (
						<option key={branch} value={branch}>
							{branch}
						</option>
					))}
				</select>
			</label>
			<label>
				Coordinate
				<input
					type='range'
					min={0}
					max={Math.max(stops.length - 1, 0)}
					value={safeIndex}
					onChange={(event: ChangeEvent<HTMLInputElement>) => {
						const next = Number(event.target.value)
						if (Number.isInteger(next)) setIndex(next)
					}}
				/>
				{stop === undefined
					? 'origin'
					: `chapter ${stop.chapterOrder}, scene ${stop.sceneIndex}, beat ${stop.beatIndex}`}
			</label>
			{sheet === undefined ? (
				<p>No character at this coordinate.</p>
			) : (
				<section>
					<h2>{sheet.name}</h2>
					<Radar stats={sheet.stats} />
					<ul>
						{sortedStats(sheet.stats).map(([stat, value]) => (
							<li key={stat}>
								{stat} {value}
							</li>
						))}
					</ul>
					<ul>
						{sheet.inventory.map(item => (
							<li key={item.itemId}>
								{item.name} × {item.quantity}
							</li>
						))}
					</ul>
					<ul>
						{sheet.activeStatuses.map(status => (
							<li key={status.name}>
								{status.name}
								{status.durationScenes === undefined
									? ''
									: ` (${status.durationScenes} scenes)`}
							</li>
						))}
					</ul>
					<ul>
						{sheet.affinities.map(affinity => (
							<li key={`${affinity.object}:${affinity.axis}`}>
								{affinity.axis} {affinity.score} toward {affinity.object}
							</li>
						))}
					</ul>
				</section>
			)}
			{snapshot === undefined ? null : (
				<GraphView
					snapshot={snapshot}
					selectedId={selectedId}
					onSelect={nodeId => {
						if (!nodeId.startsWith('character:')) return
						setCharacterId(nodeId.slice('character:'.length))
					}}
				/>
			)}
		</div>
	)
}

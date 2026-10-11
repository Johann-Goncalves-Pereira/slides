import type { MatrixRow } from '../domain/blocks/matrix'
import type { ReadError } from '../domain/blocks/read'
import type { CharacterSheet } from '../domain/hud/stops'
import type { StoryEvent } from '../domain/story/event'

export const blockMessage = (cause: ReadError): string => {
	switch (cause._tag) {
		case 'NotAChapter':
			return 'This block reads a chapter note.'
		case 'MissingEvent':
			return 'That event is not in the ledger at this chapter.'
		case 'UnknownCharacter':
			return 'That character is not in the world.'
		case 'EmptyMatrix':
		case 'RehydrationError':
			return cause.message
		default:
			return 'Could not read this block.'
	}
}

const byLabel = (
	left: readonly [string, number],
	right: readonly [string, number],
): -1 | 0 | 1 => {
	if (left[0] < right[0]) return -1
	if (left[0] > right[0]) return 1
	return 0
}

const eventLines = (event: StoryEvent): readonly string[] => {
	switch (event.type) {
		case 'STAT_CHANGE':
			return Object.entries(event.deltas)
				.sort(byLabel)
				.map(([stat, delta]) => `${stat} ${delta}`)
		case 'AFFINITY_SHIFT':
			return [`${event.object} ${event.axis} ${event.delta}`]
		case 'INVENTORY_MUTATION':
			return [`${event.op} ${event.name} ${event.quantity}`]
		case 'STATUS_EFFECT':
			return [
				event.durationScenes === undefined
					? `${event.op} ${event.name}`
					: `${event.op} ${event.name} ${event.durationScenes}`,
			]
		case 'OVERRIDE_SYNC':
			return Object.entries(event.stats)
				.sort(byLabel)
				.map(([stat, value]) => `${stat} = ${value}`)
	}
}

export const BlockNotice = ({ message }: { readonly message: string }) => (
	<p className='writing-block'>{message}</p>
)

export const CharacterSheetBlock = ({
	sheet,
}: {
	readonly sheet: CharacterSheet
}) => (
	<section className='writing-block'>
		<h3>{sheet.name}</h3>
		<ul>
			{Object.entries(sheet.stats)
				.sort(byLabel)
				.map(([stat, value]) => (
					<li key={stat}>
						{stat}: {value}
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
						: ` ${status.durationScenes}`}
				</li>
			))}
		</ul>
		<ul>
			{sheet.affinities.map(affinity => (
				<li key={`${affinity.object}:${affinity.axis}`}>
					{affinity.object} {affinity.axis} {affinity.score}
				</li>
			))}
		</ul>
	</section>
)

export const RelationshipMatrixBlock = ({
	rows,
}: {
	readonly rows: readonly MatrixRow[]
}) => (
	<table className='writing-block'>
		<thead>
			<tr>
				<th>Subject</th>
				<th>Object</th>
				<th>Axis</th>
				<th>Score</th>
			</tr>
		</thead>
		<tbody>
			{rows.map(row => (
				<tr key={`${row.subject}|${row.object}|${row.axis}`}>
					<td>{row.subject}</td>
					<td>{row.object}</td>
					<td>{row.axis}</td>
					<td>{row.score}</td>
				</tr>
			))}
		</tbody>
	</table>
)

export const RpgEventBlock = ({
	event,
	onRemove,
}: {
	readonly event: StoryEvent
	readonly onRemove: () => void
}) => (
	<section className='writing-block'>
		<h3>{event.type}</h3>
		<p>{event.targetEntity}</p>
		<ul>
			{eventLines(event).map(line => (
				<li key={line}>{line}</li>
			))}
		</ul>
		<button type='button' onClick={onRemove}>
			Remove event
		</button>
	</section>
)

export const blockCss = `
.writing-block {
	background: #0B0F19;
	color: #D4AF37;
	font-family: sans-serif;
	border: 1px solid #1E1611;
	padding: 8px 12px;
}
.writing-block h3 {
	font-family: serif;
	color: #00E5FF;
	margin: 0 0 8px;
}
.writing-block button {
	font-family: sans-serif;
	background: #1E1611;
	color: #D4AF37;
	border: 1px solid #A855F7;
}
.writing-block th,
.writing-block td {
	border-bottom: 1px solid #1E1611;
	text-align: left;
	padding: 4px;
}
`

import { Effect } from 'effect'
import type { StoryCoordinate } from '../story/coordinate'
import type { RehydrationError } from '../story/errors'
import { Ledger } from '../story/ledger'
import type { ReduceError } from '../story/reduce'
import { rehydrateAt } from '../story/rehydrate'
import type { EventSidecar } from './frontmatter'
import type { IndexError, VaultIndex } from './index'
import { ledgerFromIndex } from './index'

export type StatDrift = {
	readonly path: string
	readonly noteId: string
	readonly characterId: string
	readonly coordinate: StoryCoordinate
	readonly stats: { readonly [stat: string]: number }
}

const statsDiffer = (
	folded: { readonly [stat: string]: number },
	override: { readonly [stat: string]: number },
): boolean =>
	Object.entries(override).some(
		([stat, value]) => (folded[stat] ?? 0) !== value,
	)

export const findStatDrift = (
	index: VaultIndex,
): Effect.Effect<
	readonly StatDrift[],
	IndexError | ReduceError | RehydrationError
> =>
	Effect.gen(function* () {
		const ledger = yield* ledgerFromIndex(index)
		const drifts: StatDrift[] = []
		for (const note of index.byId.values()) {
			if (note.kind !== 'chapter') continue
			if (Object.keys(note.overrides).length === 0) continue
			const world = yield* rehydrateAt(note.coordinate).pipe(
				Effect.provideService(Ledger, ledger),
			)
			for (const [characterId, stats] of Object.entries(note.overrides)) {
				const character = world.characters[characterId]
				if (character === undefined) continue
				if (!statsDiffer(character.stats, stats)) continue
				drifts.push({
					path: note.path,
					noteId: note.noteId,
					characterId,
					coordinate: note.coordinate,
					stats,
				})
			}
		}
		return drifts
	})

export const appendOverrideSync = (
	sidecar: EventSidecar,
	drift: StatDrift,
): EventSidecar => ({
	...sidecar,
	events: [
		...sidecar.events,
		{
			eventId: `override:${drift.noteId}:${drift.characterId}`,
			targetEntity: drift.characterId,
			coordinate: drift.coordinate,
			type: 'OVERRIDE_SYNC',
			stats: drift.stats,
		},
	],
})

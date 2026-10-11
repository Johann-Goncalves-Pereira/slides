import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { compareCoordinates } from './coordinate'
import { decodeStoryEvent } from './event'
import { Ledger, makeMemoryLedger } from './ledger'
import { reduceWorld } from './reduce'
import { rehydrateAt } from './rehydrate'
import { buildSnapshots, manuscriptSnapshotPolicy } from './snapshot'
import { decodeWorldState } from './state'

const arthurWorld = {
	characters: {
		Arthur: {
			characterId: 'Arthur',
			name: 'Arthur',
			stats: { HP: 100 },
			inventory: [],
			affinities: [],
			activeStatuses: [],
			lastUpdatedCoordinate: {
				branchId: 'main',
				chapterOrder: 0,
				sceneIndex: 0,
				beatIndex: 0,
				timestamp: 0,
			},
		},
	},
}

const stat = (
	eventId: string,
	branchId: string,
	chapterOrder: number,
	beatIndex: number,
	timestamp: number,
	delta: number,
) =>
	decodeStoryEvent({
		eventId,
		targetEntity: 'Arthur',
		coordinate: {
			branchId,
			chapterOrder,
			sceneIndex: 1,
			beatIndex,
			timestamp,
		},
		type: 'STAT_CHANGE',
		deltas: { HP: delta },
	})

const at = (
	branchId: string,
	chapterOrder: number,
	beatIndex: number,
	timestamp: number,
) => ({
	branchId,
	chapterOrder,
	sceneIndex: 1,
	beatIndex,
	timestamp,
})

describe('buildSnapshots', () => {
	it('uses chapter and event checkpoints from the manuscript policy', () => {
		expect(manuscriptSnapshotPolicy.everyNEvents).toBe(250)
		expect(manuscriptSnapshotPolicy.everyNChapters).toBe(25)
	})
})

describe('rehydrateAt', () => {
	it('matches a full fold at a midpoint, the end, and another branch', async () => {
		const initial = await Effect.runPromise(decodeWorldState(arthurWorld))
		const events = await Effect.runPromise(
			Effect.all([
				stat('m1', 'main', 1, 1, 1, -10),
				stat('m2', 'main', 1, 2, 2, -5),
				stat('m3', 'main', 2, 1, 3, 1),
				stat('m4', 'main', 2, 2, 4, 2),
				stat('a1', 'alt', 1, 1, 1, 100),
			]),
		)
		const snapshots = await Effect.runPromise(
			buildSnapshots(initial, events, {
				everyNEvents: 2,
				everyNChapters: 2,
			}),
		)
		expect(
			snapshots.map(snapshot => ({
				branchId: snapshot.coordinate.branchId,
				timestamp: snapshot.coordinate.timestamp,
				eventCount: snapshot.eventCount,
				hp: snapshot.state.characters.Arthur?.stats.HP,
			})),
		).toEqual([
			{ branchId: 'main', timestamp: 2, eventCount: 2, hp: 85 },
			{ branchId: 'main', timestamp: 4, eventCount: 4, hp: 88 },
		])

		const ledger = makeMemoryLedger({
			initialState: initial,
			events,
			snapshots,
		})
		const read = (coordinate: ReturnType<typeof at>) =>
			Effect.runPromise(
				rehydrateAt(coordinate).pipe(Effect.provideService(Ledger, ledger)),
			)
		const fold = (coordinate: ReturnType<typeof at>) =>
			Effect.runPromise(
				reduceWorld(
					initial,
					events.filter(
						event =>
							event.coordinate.branchId === coordinate.branchId &&
							compareCoordinates(event.coordinate, coordinate) <= 0,
					),
				),
			)

		const opening = at('main', 1, 1, 1)
		const middle = at('main', 2, 1, 3)
		const ending = at('main', 2, 2, 4)
		const alternate = at('alt', 1, 1, 1)

		expect((await read(opening)).characters.Arthur?.stats.HP).toBe(90)
		expect(await read(opening)).toEqual(await fold(opening))
		expect((await read(middle)).characters.Arthur?.stats.HP).toBe(86)
		expect(await read(middle)).toEqual(await fold(middle))
		expect((await read(ending)).characters.Arthur?.stats.HP).toBe(88)
		expect(await read(ending)).toEqual(await fold(ending))
		expect((await read(alternate)).characters.Arthur?.stats.HP).toBe(200)
		expect(await read(alternate)).toEqual(await fold(alternate))
	})
})

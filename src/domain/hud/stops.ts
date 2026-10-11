import { Data, Effect, type ParseResult } from 'effect'
import { compareCoordinates, type StoryCoordinate } from '../story/coordinate'
import {
	type ActiveStatus,
	type Affinity,
	decodeWorldState,
	type InventoryItem,
} from '../story/state'
import { remainingStatuses } from '../story/status'

export type StopSource = {
	readonly coordinate: StoryCoordinate
	readonly tombstoned: boolean
}

const keyOf = (coordinate: StoryCoordinate): string =>
	[
		coordinate.branchId,
		coordinate.chapterOrder,
		coordinate.sceneIndex,
		coordinate.beatIndex,
		coordinate.timestamp,
	].join('|')

export const storyStops = (
	chapters: readonly StopSource[],
	branchId: string,
	events: readonly { readonly coordinate: StoryCoordinate }[] = [],
): readonly StoryCoordinate[] => {
	const stops: StoryCoordinate[] = []
	const seen = new Set<string>()
	const push = (coordinate: StoryCoordinate): void => {
		const key = keyOf(coordinate)
		if (seen.has(key)) return
		seen.add(key)
		stops.push(coordinate)
	}
	push({
		branchId,
		chapterOrder: 0,
		sceneIndex: 0,
		beatIndex: 0,
		timestamp: 0,
	})
	const ordered = [
		...chapters
			.filter(
				chapter =>
					!chapter.tombstoned && chapter.coordinate.branchId === branchId,
			)
			.map(chapter => chapter.coordinate),
		...events
			.map(event => event.coordinate)
			.filter(coordinate => coordinate.branchId === branchId),
	].sort(compareCoordinates)
	for (const coordinate of ordered) push(coordinate)
	return stops
}

export class UnknownCharacter extends Data.TaggedError('UnknownCharacter')<{
	readonly characterId: string
}> {}

export type CharacterSheet = {
	readonly characterId: string
	readonly name: string
	readonly stats: { readonly [stat: string]: number }
	readonly inventory: readonly InventoryItem[]
	readonly activeStatuses: readonly ActiveStatus[]
	readonly affinities: readonly Affinity[]
	readonly factions: readonly string[]
	readonly location?: string
	readonly flags: { readonly [flag: string]: boolean }
}

export const projectSheet = (
	world: unknown,
	characterId: string,
	viewed?: {
		readonly at: StoryCoordinate
		readonly scenes: readonly StoryCoordinate[]
	},
): Effect.Effect<CharacterSheet, UnknownCharacter | ParseResult.ParseError> =>
	Effect.gen(function* () {
		const decoded = yield* decodeWorldState(world)
		const character = decoded.characters[characterId]
		if (character === undefined) {
			return yield* Effect.fail(new UnknownCharacter({ characterId }))
		}
		const activeStatuses =
			viewed === undefined
				? character.activeStatuses
				: remainingStatuses(character.activeStatuses, viewed.at, viewed.scenes)
		const sheet = {
			characterId: character.characterId,
			name: character.name,
			stats: character.stats,
			inventory: character.inventory,
			activeStatuses,
			affinities: character.affinities,
			factions: character.factions,
			flags: decoded.globalFlags,
		}
		if (character.location === undefined) return sheet
		return { ...sheet, location: character.location }
	})

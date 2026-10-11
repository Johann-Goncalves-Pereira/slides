import { Data, Effect, type ParseResult, Schema } from 'effect'
import { decodeWorldState } from '../story/state'

export const MatrixRow = Schema.Struct({
	subject: Schema.NonEmptyString,
	object: Schema.NonEmptyString,
	axis: Schema.NonEmptyString,
	score: Schema.Finite,
})

export type MatrixRow = typeof MatrixRow.Type

export class EmptyMatrix extends Data.TaggedError('EmptyMatrix')<{
	readonly message: string
}> {}

const compareRows = (left: MatrixRow, right: MatrixRow): -1 | 0 | 1 => {
	if (left.subject < right.subject) return -1
	if (left.subject > right.subject) return 1
	if (left.object < right.object) return -1
	if (left.object > right.object) return 1
	if (left.axis < right.axis) return -1
	if (left.axis > right.axis) return 1
	return 0
}

export const projectMatrix = (
	world: unknown,
): Effect.Effect<readonly MatrixRow[], EmptyMatrix | ParseResult.ParseError> =>
	Effect.gen(function* () {
		const decoded = yield* decodeWorldState(world)
		const rows: MatrixRow[] = []
		for (const character of Object.values(decoded.characters)) {
			for (const affinity of character.affinities) {
				rows.push({
					subject: character.characterId,
					object: affinity.object,
					axis: affinity.axis,
					score: affinity.score,
				})
			}
		}
		if (rows.length === 0) {
			return yield* new EmptyMatrix({
				message: 'This coordinate has no affinities.',
			})
		}
		return rows.sort(compareRows)
	})

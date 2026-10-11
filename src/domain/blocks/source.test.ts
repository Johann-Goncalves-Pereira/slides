import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import {
	decodeCharacterSheetSource,
	decodeRelationshipMatrixSource,
	decodeRpgEventSource,
} from './source'

describe('block sources', () => {
	it('reads one character id, one event id, and an empty matrix', async () => {
		const sheet = await Effect.runPromise(
			decodeCharacterSheetSource('  Arthur\n'),
		)
		const event = await Effect.runPromise(decodeRpgEventSource(' evt-1 '))
		const matrix = await Effect.runPromise(
			decodeRelationshipMatrixSource(' \n '),
		)
		expect(sheet).toBe('Arthur')
		expect(event).toBe('evt-1')
		expect(matrix).toBe('')
		const blankSheet = await Effect.runPromise(
			Effect.either(decodeCharacterSheetSource('  \n')),
		)
		const filledMatrix = await Effect.runPromise(
			Effect.either(decodeRelationshipMatrixSource('Arthur')),
		)
		expect(blankSheet._tag).toBe('Left')
		expect(filledMatrix._tag).toBe('Left')
	})
})

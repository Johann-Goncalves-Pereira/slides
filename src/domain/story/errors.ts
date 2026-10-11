import { Data } from 'effect'

export class UnknownEntity extends Data.TaggedError('UnknownEntity')<{
	readonly targetEntity: string
	readonly eventId: string
}> {}

export class InsufficientQuantity extends Data.TaggedError(
	'InsufficientQuantity',
)<{
	readonly targetEntity: string
	readonly itemId: string
	readonly held: number
	readonly requested: number
	readonly eventId: string
}> {}

export class RehydrationError extends Data.TaggedError('RehydrationError')<{
	readonly message: string
	readonly cause?: UnknownEntity | InsufficientQuantity
}> {}

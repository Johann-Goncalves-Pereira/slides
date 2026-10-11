import { Data } from 'effect'

export class AudioError extends Data.TaggedError('AudioError')<{
	readonly message: string
}> {}

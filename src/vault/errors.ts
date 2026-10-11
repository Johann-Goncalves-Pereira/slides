import { Data } from 'effect'

export class VaultIoError extends Data.TaggedError('VaultIoError')<{
	readonly message: string
	readonly cause: unknown
}> {}

export class SidecarJsonError extends Data.TaggedError('SidecarJsonError')<{
	readonly path: string
	readonly cause: unknown
}> {}

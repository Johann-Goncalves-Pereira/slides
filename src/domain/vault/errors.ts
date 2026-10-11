import { Data } from 'effect'

export class MissingNoteId extends Data.TaggedError('MissingNoteId')<{
	readonly path: string
}> {}

export class DuplicateNoteId extends Data.TaggedError('DuplicateNoteId')<{
	readonly noteId: string
	readonly path: string
}> {}

export class SidecarMismatch extends Data.TaggedError('SidecarMismatch')<{
	readonly path: string
	readonly noteId: string
	readonly sidecarNoteId: string
}> {}

export class DuplicateCharacter extends Data.TaggedError('DuplicateCharacter')<{
	readonly characterId: string
}> {}

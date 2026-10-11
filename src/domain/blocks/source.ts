import { Schema } from 'effect'

const IdSource = Schema.compose(Schema.Trim, Schema.NonEmptyString)

export const decodeCharacterSheetSource = Schema.decodeUnknown(IdSource)

export const decodeRpgEventSource = Schema.decodeUnknown(IdSource)

export const decodeRelationshipMatrixSource = Schema.decodeUnknown(
	Schema.compose(Schema.Trim, Schema.Literal('')),
)

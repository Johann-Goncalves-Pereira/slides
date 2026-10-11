import { Schema } from 'effect'
import manifestJson from '../../manifest.json'

export const Manifest = Schema.Struct({
	id: Schema.NonEmptyString,
	name: Schema.NonEmptyString,
	version: Schema.NonEmptyString,
	minAppVersion: Schema.NonEmptyString,
	description: Schema.String,
	isDesktopOnly: Schema.Boolean,
})

export type Manifest = typeof Manifest.Type

export const decodeManifest = Schema.decodeUnknown(Manifest)

export const runLoad = () => decodeManifest(manifestJson)

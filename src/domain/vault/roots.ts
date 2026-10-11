import { Schema } from 'effect'

const root = (fallback: string) =>
	Schema.optionalWith(Schema.NonEmptyString, { default: () => fallback })

export const VaultRoots = Schema.Struct({
	livro: root('Livro'),
	personagens: root('Personagens'),
	mundo: root('Mundo'),
	assets: root('Assets'),
})

export type VaultRoots = typeof VaultRoots.Type

export const defaultVaultRoots: VaultRoots = {
	livro: 'Livro',
	personagens: 'Personagens',
	mundo: 'Mundo',
	assets: 'Assets',
}

export const decodeVaultRoots = Schema.decodeUnknown(VaultRoots)

export const defaultPauseMillis = 30_000

export const PluginSettings = Schema.Struct({
	livro: root('Livro'),
	personagens: root('Personagens'),
	mundo: root('Mundo'),
	assets: root('Assets'),
	modelBaseUrl: Schema.optionalWith(Schema.NonEmptyString, {
		default: () => 'http://127.0.0.1:11434',
	}),
	modelName: Schema.optionalWith(Schema.NonEmptyString, {
		default: () => 'qwen2.5:1.5b',
	}),
	pauseMillis: Schema.optionalWith(Schema.NonNegativeInt, {
		default: () => defaultPauseMillis,
	}),
})

export type PluginSettings = typeof PluginSettings.Type

export const defaultPluginSettings: PluginSettings = {
	...defaultVaultRoots,
	modelBaseUrl: 'http://127.0.0.1:11434',
	modelName: 'qwen2.5:1.5b',
	pauseMillis: defaultPauseMillis,
}

export const decodePluginSettings = Schema.decodeUnknown(PluginSettings)

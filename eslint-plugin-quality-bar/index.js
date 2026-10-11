import noAsyncApiExport from './rules/no-async-api-export.js'
import noBlindCatch from './rules/no-blind-catch.js'
import noEmptyCatch from './rules/no-empty-catch.js'
import noFetchInApi from './rules/no-fetch-in-api.js'
import noFireAndForget from './rules/no-fire-and-forget.js'
import noPromiseConstructor from './rules/no-promise-constructor.js'
import noSentinelCatch from './rules/no-sentinel-catch.js'
import noSleepSync from './rules/no-sleep-sync.js'
import noTautologicalExpect from './rules/no-tautological-expect.js'
import noThrowInApi from './rules/no-throw-in-api.js'

/** Portable lazy / Effect gates (error severity). */
export const recommendedRules = {
	'quality-bar/no-empty-catch': 'error',
	'quality-bar/no-blind-catch': 'error',
	'quality-bar/no-fire-and-forget': 'error',
	'quality-bar/no-sleep-sync': 'error',
	'quality-bar/no-promise-constructor': 'error',
	'quality-bar/no-tautological-expect': 'error',
	'quality-bar/no-throw-in-api': 'error',
	'quality-bar/no-async-api-export': 'error',
	'quality-bar/no-fetch-in-api': 'error',
	'quality-bar/no-sentinel-catch': 'error',
}

/** @type {import('eslint').ESLint.Plugin} */
const plugin = {
	meta: {
		name: 'eslint-plugin-quality-bar',
		version: '0.1.0',
	},
	rules: {
		'no-empty-catch': noEmptyCatch,
		'no-blind-catch': noBlindCatch,
		'no-fire-and-forget': noFireAndForget,
		'no-sleep-sync': noSleepSync,
		'no-promise-constructor': noPromiseConstructor,
		'no-tautological-expect': noTautologicalExpect,
		'no-throw-in-api': noThrowInApi,
		'no-async-api-export': noAsyncApiExport,
		'no-fetch-in-api': noFetchInApi,
		'no-sentinel-catch': noSentinelCatch,
	},
	configs: {},
}

plugin.configs.recommended = {
	plugins: {
		'quality-bar': plugin,
	},
	rules: recommendedRules,
}

export default plugin

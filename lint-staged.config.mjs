/**
 * Biome formats; ESLint fixes TypeScript and JavaScript.
 * Strict profile fails the commit on warnings.
 */
export default {
	'*.{json,md,yml,yaml,css,mjs,cjs}': [
		'biome check --write --no-errors-on-unmatched',
	],
	'*.{ts,tsx,js,jsx}': [
		'biome check --write --no-errors-on-unmatched',
		'eslint --fix --max-warnings 0 --no-warn-ignored',
	],
}

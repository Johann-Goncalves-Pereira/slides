/**
 * Shared path helpers for quality-bar ESLint rules (no project-specific layout).
 */

/** @param {import('eslint').Rule.RuleContext} context */
export function ruleFilename(context) {
	return String(context.filename ?? context.getFilename?.() ?? '').replace(
		/\\/g,
		'/',
	)
}

/** @param {string} filename */
export function isTestFilename(filename) {
	return /\.(test|spec)\.[cm]?[jt]sx?$/.test(filename)
}

/**
 * Application / library source (not tests, not node_modules, not config).
 * @param {string} filename
 */
export function isAppSource(filename) {
	if (!filename || filename.includes('/node_modules/')) return false
	if (isTestFilename(filename)) return false
	if (/\.(config|setup)\.[cm]?[jt]sx?$/.test(filename)) return false
	return /\.[cm]?[jt]sx?$/.test(filename)
}

/**
 * `api/` or `domain/` source. Effect gates apply here, not in UI components.
 * @param {string} filename
 */
export function isApiOrDomain(filename) {
	if (!isAppSource(filename)) return false
	return /\/(api|domain)\//.test(filename)
}

/**
 * Sole HTTP port: a file named `api-client`.
 * @param {string} filename
 */
export function isApiClientFile(filename) {
	return /\/api-client\.[cm]?[jt]sx?$/.test(filename)
}

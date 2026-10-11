/**
 * Ban catch clauses that only swallow or soft-fail without rethrow / return / log.
 */
import { isAppSource, isTestFilename, ruleFilename } from '../rule-scope.js'

/** @param {import('estree').Node} node */
function sourceHasHandling(node, sourceCode) {
	const text = sourceCode.getText(node)
	return (
		/\bthrow\b/.test(text) ||
		/\breturn\b/.test(text) ||
		/\bconsole\.(error|warn|info)\b/.test(text) ||
		/\blogger\./.test(text) ||
		/\breport(Error|Exception)?\b/.test(text) ||
		/\bSentry\b/.test(text) ||
		/\bcaptureException\b/.test(text)
	)
}

/** @type {import('eslint').Rule.RuleModule} */
const noBlindCatch = {
	meta: {
		type: 'problem',
		docs: {
			description:
				'Disallow blind catch in app source; require rethrow, return, or explicit log/report',
		},
		schema: [],
		messages: {
			blindCatch:
				'Blind catch — rethrow, return an error value, or log/report the failure explicitly.',
		},
	},
	create(context) {
		const filename = ruleFilename(context)
		if (isTestFilename(filename)) return {}
		if (!isAppSource(filename)) return {}

		const sourceCode = context.sourceCode ?? context.getSourceCode()
		return {
			CatchClause(node) {
				if (sourceHasHandling(node.body, sourceCode)) return
				context.report({ node, messageId: 'blindCatch' })
			},
		}
	},
}

export default noBlindCatch

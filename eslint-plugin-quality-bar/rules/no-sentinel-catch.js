/**
 * Ban catch / Effect.catchAll that suppress failures as null or false.
 */
import { isApiOrDomain, ruleFilename } from '../rule-scope.js'

/** @param {import('estree').Node} node */
function sourceHasAllowedHandling(node, sourceCode) {
	const text = sourceCode.getText(node)
	return (
		/\bOption\.(none|some)\b/.test(text) ||
		/\bMatch\b/.test(text) ||
		/\bcatchTags?\b/.test(text) ||
		/\bEffect\.fail\b/.test(text) ||
		/\bTaggedError\b/.test(text) ||
		/\bthrow\b/.test(text)
	)
}

/** @param {string} text */
function hasSentinelReturn(text) {
	return (
		/\breturn\s+(null|false|undefined)\b/.test(text) ||
		/\bEffect\.succeed(?:\s*<[^>]*>)?\s*\(\s*(null|false|undefined)\s*\)/.test(
			text,
		) ||
		/\bsucceed(?:\s*<[^>]*>)?\s*\(\s*(null|false|undefined)\s*\)/.test(text)
	)
}

/** @param {import('estree').Node | null | undefined} callee */
function isCatchAllCallee(callee) {
	if (callee?.type !== 'MemberExpression') return false
	if (callee.property.type !== 'Identifier') return false
	const name = callee.property.name
	return name === 'catchAll' || name === 'catchAllCause'
}

/** @type {import('eslint').Rule.RuleModule} */
const noSentinelCatch = {
	meta: {
		type: 'problem',
		docs: {
			description:
				'Disallow catch/catchAll that suppress errors as null or false',
		},
		schema: [],
		messages: {
			sentinelCatch:
				'Do not suppress errors as null or false. Use Option.none, Data.TaggedError, Match, or Effect.fail.',
		},
	},
	create(context) {
		const filename = ruleFilename(context)
		if (!isApiOrDomain(filename)) return {}

		const sourceCode = context.sourceCode ?? context.getSourceCode()
		return {
			CatchClause(node) {
				const body = node.body
				if (sourceHasAllowedHandling(body, sourceCode)) return
				const text = sourceCode.getText(body)
				if (!hasSentinelReturn(text)) return
				context.report({ node, messageId: 'sentinelCatch' })
			},
			CallExpression(node) {
				if (!isCatchAllCallee(node.callee)) return
				const arg = node.arguments[0]
				if (!arg) return
				if (sourceHasAllowedHandling(arg, sourceCode)) return
				const text = sourceCode.getText(arg)
				if (!hasSentinelReturn(text)) return
				context.report({ node, messageId: 'sentinelCatch' })
			},
		}
	},
}

export default noSentinelCatch

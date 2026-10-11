/**
 * Ban fire-and-forget floating promises via void CallExpression in app source.
 * Allowed: `void unusedIdent`, and `void promise.catch(...)` / `.finally(...)`.
 */
import { isAppSource, ruleFilename } from '../rule-scope.js'

/** @param {import('estree').Node} node */
function isSupervisedPromiseCall(node) {
	if (node.type !== 'CallExpression') return false
	const callee = node.callee
	if (callee.type !== 'MemberExpression') return false
	if (callee.property.type !== 'Identifier') return false
	return callee.property.name === 'catch' || callee.property.name === 'finally'
}

/** @type {import('eslint').Rule.RuleModule} */
const noFireAndForget = {
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow void <call>() in app source (orphaned async)',
		},
		schema: [],
		messages: {
			fireAndForget:
				'Do not void a CallExpression — await it, return the promise, or attach .catch / .finally.',
		},
	},
	create(context) {
		const filename = ruleFilename(context)
		if (!isAppSource(filename)) return {}

		return {
			UnaryExpression(node) {
				if (node.operator !== 'void') return
				if (node.argument.type !== 'CallExpression') return
				if (isSupervisedPromiseCall(node.argument)) return
				context.report({ node, messageId: 'fireAndForget' })
			},
		}
	},
}

export default noFireAndForget

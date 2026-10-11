/**
 * Ban naked sleep/setTimeout used as the sole wait in tests.
 * Prefer pollUntil / waitFor / Testing Library waitFor.
 */
import { isTestFilename, ruleFilename } from '../rule-scope.js'

/** @type {import('eslint').Rule.RuleModule} */
const noSleepSync = {
	meta: {
		type: 'problem',
		docs: {
			description:
				'Disallow setTimeout/sleep as race fixes in tests; use pollUntil or waitFor',
		},
		schema: [],
		messages: {
			sleepSync:
				'Do not use {{name}} to paper over races in tests — use pollUntil, waitFor, or an explicit event/callback.',
		},
	},
	create(context) {
		const filename = ruleFilename(context)
		if (!isTestFilename(filename)) return {}

		return {
			'NewExpression[callee.name="Promise"] > ArrowFunctionExpression CallExpression'(
				node,
			) {
				const callee = node.callee
				if (callee.type !== 'Identifier') return
				if (callee.name !== 'setTimeout' && callee.name !== 'sleep') return
				let parent = node.parent
				while (parent) {
					if (
						parent.type === 'CallExpression' &&
						parent.callee.type === 'Identifier' &&
						(parent.callee.name === 'pollUntil' ||
							parent.callee.name === 'waitFor')
					) {
						return
					}
					parent = parent.parent
				}
				context.report({
					node,
					messageId: 'sleepSync',
					data: { name: callee.name },
				})
			},
			CallExpression(node) {
				if (node.callee.type !== 'Identifier') return
				if (node.callee.name !== 'sleep' && node.callee.name !== 'delay') return
				context.report({
					node,
					messageId: 'sleepSync',
					data: { name: node.callee.name },
				})
			},
		}
	},
}

export default noSleepSync

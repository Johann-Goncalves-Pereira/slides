/**
 * Ban `new Promise(...)` in app source — prefer async/await or library helpers.
 */
import { isAppSource, isTestFilename, ruleFilename } from '../rule-scope.js'

/** @type {import('eslint').Rule.RuleModule} */
const noPromiseConstructor = {
	meta: {
		type: 'problem',
		docs: {
			description:
				'Disallow new Promise in app source; prefer async/await or Promise-returning APIs',
		},
		schema: [],
		messages: {
			promiseCtor:
				'Do not use new Promise in app source — prefer async/await or a library helper that returns a Promise.',
		},
	},
	create(context) {
		const filename = ruleFilename(context)
		if (isTestFilename(filename)) return {}
		if (!isAppSource(filename)) return {}

		return {
			NewExpression(node) {
				if (node.callee.type !== 'Identifier') return
				if (node.callee.name !== 'Promise') return
				context.report({ node, messageId: 'promiseCtor' })
			},
		}
	},
}

export default noPromiseConstructor

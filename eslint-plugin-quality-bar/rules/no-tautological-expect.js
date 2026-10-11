/**
 * Ban tautological vitest/jest assertions.
 */
import { isTestFilename, ruleFilename } from '../rule-scope.js'

/** @type {import('eslint').Rule.RuleModule} */
const noTautologicalExpect = {
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow expect(true), bare toBeDefined, empty toBeTruthy',
		},
		schema: [],
		messages: {
			tautology: 'Tautological assertion — assert a concrete value.',
		},
	},
	create(context) {
		const filename = ruleFilename(context)
		if (!isTestFilename(filename)) return {}

		return {
			CallExpression(node) {
				const callee = node.callee
				if (callee.type !== 'MemberExpression') return
				if (callee.property.type !== 'Identifier') return
				const method = callee.property.name
				const obj = callee.object
				if (obj.type !== 'CallExpression') return
				if (obj.callee.type !== 'Identifier' || obj.callee.name !== 'expect') {
					return
				}
				const arg = obj.arguments[0]
				if (
					method === 'toBe' &&
					arg &&
					arg.type === 'Literal' &&
					arg.value === true
				) {
					context.report({ node, messageId: 'tautology' })
					return
				}
				if (method === 'toBeDefined' && obj.arguments.length === 1) {
					context.report({ node, messageId: 'tautology' })
					return
				}
				if (method === 'toBeTruthy' && obj.arguments.length === 1) {
					context.report({ node, messageId: 'tautology' })
				}
			},
		}
	},
}

export default noTautologicalExpect

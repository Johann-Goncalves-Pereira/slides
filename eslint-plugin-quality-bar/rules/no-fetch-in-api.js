/**
 * Ban raw fetch() in api/ and domain/ except a file named api-client.
 */
import { isApiClientFile, isApiOrDomain, ruleFilename } from '../rule-scope.js'

/** @type {import('eslint').Rule.RuleModule} */
const noFetchInApi = {
	meta: {
		type: 'problem',
		docs: {
			description:
				'Disallow raw fetch in api/ and domain/; use the api-client module',
		},
		schema: [],
		messages: {
			rawFetch:
				'Do not call fetch in api/ or domain/. Use the api-client module.',
		},
	},
	create(context) {
		const filename = ruleFilename(context)
		if (!isApiOrDomain(filename)) return {}
		if (isApiClientFile(filename)) return {}

		return {
			CallExpression(node) {
				if (node.callee.type !== 'Identifier') return
				if (node.callee.name !== 'fetch') return
				context.report({ node, messageId: 'rawFetch' })
			},
		}
	},
}

export default noFetchInApi

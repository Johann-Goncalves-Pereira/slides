/**
 * Ban throw in api/ and domain/. Failures are TaggedError or Effect.fail.
 */
import { isApiOrDomain, ruleFilename } from '../rule-scope.js'

/** @type {import('eslint').Rule.RuleModule} */
const noThrowInApi = {
	meta: {
		type: 'problem',
		docs: {
			description:
				'Disallow throw in api/ and domain/; surface TaggedError or Effect failures',
		},
		schema: [],
		messages: {
			noThrow:
				'Do not throw in api/ or domain/. Return Data.TaggedError or fail the Effect.',
		},
	},
	create(context) {
		const filename = ruleFilename(context)
		if (!isApiOrDomain(filename)) return {}

		return {
			ThrowStatement(node) {
				context.report({ node, messageId: 'noThrow' })
			},
		}
	},
}

export default noThrowInApi

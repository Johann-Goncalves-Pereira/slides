/**
 * Ban empty catch blocks. A comment alone is not handling.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
const noEmptyCatch = {
	meta: {
		type: 'problem',
		docs: {
			description:
				'Disallow empty catch clauses; rethrow, map to a Result, or handle explicitly',
		},
		schema: [],
		messages: {
			emptyCatch:
				'Empty catch swallows failures — rethrow, return an error Result, or handle explicitly. A comment is not handling.',
		},
	},
	create(context) {
		return {
			CatchClause(node) {
				if (node.body.body.length > 0) return
				context.report({ node, messageId: 'emptyCatch' })
			},
		}
	},
}

export default noEmptyCatch

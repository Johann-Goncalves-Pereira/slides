/**
 * Ban exported async from api/ and domain/ except run* edge runners.
 */
import { isApiOrDomain, ruleFilename } from '../rule-scope.js'

/** @param {string | undefined} name */
function isRunEdge(name) {
	return typeof name === 'string' && /^run[A-Z]/.test(name)
}

/** @type {import('eslint').Rule.RuleModule} */
const noAsyncApiExport = {
	meta: {
		type: 'problem',
		docs: {
			description:
				'Disallow exported async from api/ and domain/ except run* edge runners',
		},
		schema: [],
		messages: {
			asyncExport:
				'Do not export async from api/ or domain/. Return Effect.gen (run* edge runners are allowed).',
		},
	},
	create(context) {
		const filename = ruleFilename(context)
		if (!isApiOrDomain(filename)) return {}

		/**
		 * @param {import('estree').Node} node
		 * @param {string | undefined} name
		 */
		function reportIfAsync(node, name) {
			if (isRunEdge(name)) return
			context.report({ node, messageId: 'asyncExport' })
		}

		return {
			ExportNamedDeclaration(node) {
				const decl = node.declaration
				if (!decl) return
				if (decl.type === 'FunctionDeclaration' && decl.async) {
					reportIfAsync(decl, decl.id?.name)
					return
				}
				if (decl.type === 'VariableDeclaration') {
					for (const d of decl.declarations) {
						if (d.id.type !== 'Identifier') continue
						const init = d.init
						if (!init) continue
						if (
							(init.type === 'FunctionExpression' ||
								init.type === 'ArrowFunctionExpression') &&
							init.async
						) {
							reportIfAsync(init, d.id.name)
						}
					}
				}
			},
			ExportDefaultDeclaration(node) {
				const decl = node.declaration
				if (
					(decl.type === 'FunctionDeclaration' ||
						decl.type === 'FunctionExpression' ||
						decl.type === 'ArrowFunctionExpression') &&
					decl.async
				) {
					const name =
						decl.type === 'FunctionDeclaration' ? decl.id?.name : undefined
					reportIfAsync(decl, name)
				}
			},
		}
	},
}

export default noAsyncApiExport

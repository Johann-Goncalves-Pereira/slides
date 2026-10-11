import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { RuleTester } from 'eslint'
import noAsyncApiExport from './no-async-api-export.js'
import noFetchInApi from './no-fetch-in-api.js'
import noSentinelCatch from './no-sentinel-catch.js'
import noThrowInApi from './no-throw-in-api.js'

const tester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		sourceType: 'module',
	},
})

describe('quality-bar/no-throw-in-api', () => {
	it('rejects throw in api and domain', () => {
		tester.run('no-throw-in-api', noThrowInApi, {
			valid: [
				{
					code: 'function save() { throw new Error("ui") }',
					filename: '/app/src/components/Ui.tsx',
				},
				{
					code: 'const save = Effect.fail(new SaveError())',
					filename: '/app/src/api/notes.ts',
				},
			],
			invalid: [
				{
					code: 'function save() { throw new Error("no") }',
					filename: '/app/src/api/notes.ts',
					errors: [{ messageId: 'noThrow' }],
				},
				{
					code: 'function parse() { throw new Error("no") }',
					filename: '/app/src/domain/user.ts',
					errors: [{ messageId: 'noThrow' }],
				},
			],
		})
		assert.ok(true)
	})
})

describe('quality-bar/no-async-api-export', () => {
	it('rejects exported async in api and domain except run*', () => {
		tester.run('no-async-api-export', noAsyncApiExport, {
			valid: [
				{
					code: 'export async function runSave(input) { return input }',
					filename: '/app/src/api/notes.ts',
				},
				{
					code: 'export async function save() {}',
					filename: '/app/src/components/Ui.tsx',
				},
				{
					code: 'export const load = () => Effect.void',
					filename: '/app/src/domain/user.ts',
				},
			],
			invalid: [
				{
					code: 'export async function save() {}',
					filename: '/app/src/api/notes.ts',
					errors: [{ messageId: 'asyncExport' }],
				},
				{
					code: 'export const load = async () => {}',
					filename: '/app/src/domain/user.ts',
					errors: [{ messageId: 'asyncExport' }],
				},
			],
		})
		assert.ok(true)
	})
})

describe('quality-bar/no-fetch-in-api', () => {
	it('rejects raw fetch in api and domain except api-client', () => {
		tester.run('no-fetch-in-api', noFetchInApi, {
			valid: [
				{
					code: 'fetch(url)',
					filename: '/app/src/lib/api-client.ts',
				},
				{
					code: 'fetch(url)',
					filename: '/app/src/components/Ui.tsx',
				},
			],
			invalid: [
				{
					code: 'fetch(url)',
					filename: '/app/src/api/notes.ts',
					errors: [{ messageId: 'rawFetch' }],
				},
				{
					code: 'fetch(url)',
					filename: '/app/src/domain/user.ts',
					errors: [{ messageId: 'rawFetch' }],
				},
			],
		})
		assert.ok(true)
	})
})

describe('quality-bar/no-sentinel-catch', () => {
	it('rejects catch that returns null or false in api and domain', () => {
		tester.run('no-sentinel-catch', noSentinelCatch, {
			valid: [
				{
					code: 'x.pipe(Effect.catchAll(() => Option.none()))',
					filename: '/app/src/api/notes.ts',
				},
				{
					code: 'x.pipe(Effect.catchAll(() => Effect.fail(err)))',
					filename: '/app/src/domain/user.ts',
				},
				{
					code: 'function load() { try { run() } catch { return null } }',
					filename: '/app/src/components/Ui.tsx',
				},
			],
			invalid: [
				{
					code: 'function load() { try { run() } catch { return null } }',
					filename: '/app/src/api/notes.ts',
					errors: [{ messageId: 'sentinelCatch' }],
				},
				{
					code: 'x.pipe(Effect.catchAll(() => Effect.succeed(false)))',
					filename: '/app/src/domain/user.ts',
					errors: [{ messageId: 'sentinelCatch' }],
				},
			],
		})
		assert.ok(true)
	})
})

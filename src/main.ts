import { Effect } from 'effect'
import { Plugin } from 'obsidian'
import { runLoad } from './domain/manifest'

export default class SlidesPlugin extends Plugin {
	async onload() {
		await Effect.runPromise(runLoad())
	}
}

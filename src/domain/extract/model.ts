import { Context, Data, type Effect } from 'effect'

export class ModelError extends Data.TaggedError('ModelError')<{
	readonly message: string
}> {}

export class ModelClient extends Context.Tag('writing/ModelClient')<
	ModelClient,
	{
		readonly propose: (prompt: string) => Effect.Effect<unknown, ModelError>
	}
>() {}

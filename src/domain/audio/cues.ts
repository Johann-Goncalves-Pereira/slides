import { Data, Effect, Schema } from 'effect'

export class CueError extends Data.TaggedError('CueError')<{
	readonly message: string
}> {}

const FileName = Schema.NonEmptyString.pipe(
	Schema.filter(
		file =>
			(!/[\s/\\]/.test(file) && !file.split('.').includes('')) ||
			'audio file must be one path segment',
	),
)

const Volume = Schema.Finite.pipe(
	Schema.filter(
		volume => (volume >= 0 && volume <= 1) || 'volume must be from 0 through 1',
	),
)

export const AudioCue = Schema.Struct({
	file: FileName,
	volume: Volume,
	crossfade: Schema.NonNegativeInt,
	loop: Schema.optionalWith(Schema.Boolean, { default: () => true }),
})

export type AudioCue = typeof AudioCue.Type

export const audioAssetPath = (
	root: string,
	file: string,
): Effect.Effect<string, CueError> =>
	Effect.map(
		Schema.decodeUnknown(FileName)(file).pipe(
			Effect.mapError(
				() =>
					new CueError({
						message: 'Audio file must be one path segment.',
					}),
			),
		),
		name => `${root}/${name}`,
	)

const fieldsOf = (body: string): Effect.Effect<unknown, CueError> => {
	const parts = body
		.split(',')
		.map(part => part.trim())
		.filter(part => part.length > 0)
	const file = parts[0]
	if (file === undefined) {
		return Effect.fail(
			new CueError({ message: 'An audio comment needs a file name.' }),
		)
	}
	const fields: {
		file: string
		volume?: number
		crossfade?: number
		loop?: boolean
	} = { file }
	for (const part of parts.slice(1)) {
		const split = part.match(/^([A-Za-z]+)\s*:\s*(.+)$/)
		const key = split?.[1]
		const raw = split?.[2]
		if (key === undefined || raw === undefined) {
			return Effect.fail(new CueError({ message: `Could not read "${part}".` }))
		}
		if (key === 'volume' || key === 'crossfade') {
			const value = Number(raw)
			if (!Number.isFinite(value)) {
				return Effect.fail(
					new CueError({ message: `${key} must be a number.` }),
				)
			}
			fields[key] = value
			continue
		}
		if (key === 'loop') {
			if (raw !== 'true' && raw !== 'false') {
				return Effect.fail(
					new CueError({ message: 'loop must be true or false.' }),
				)
			}
			fields.loop = raw === 'true'
			continue
		}
		return Effect.fail(new CueError({ message: `Unknown audio field ${key}.` }))
	}
	return Effect.succeed(fields)
}

const commentPattern = /<!--\s*audio:([\s\S]*?)-->/g

export const parseCues = (
	markdown: string,
): {
	readonly cues: readonly AudioCue[]
	readonly errors: readonly CueError[]
} => {
	const cues: AudioCue[] = []
	const errors: CueError[] = []
	for (const match of markdown.matchAll(commentPattern)) {
		const body = match[1] ?? ''
		const parsed = Effect.runSync(
			Effect.either(
				Effect.gen(function* () {
					const fields = yield* fieldsOf(body)
					return yield* Schema.decodeUnknown(AudioCue)(fields).pipe(
						Effect.mapError(
							() =>
								new CueError({
									message: 'The audio comment could not be decoded.',
								}),
						),
					)
				}),
			),
		)
		if (parsed._tag === 'Left') errors.push(parsed.left)
		else cues.push(parsed.right)
	}
	return { cues, errors }
}

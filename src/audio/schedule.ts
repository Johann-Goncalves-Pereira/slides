import type { GainChange } from '../domain/audio/crossfade'

export type GainParam = {
	readonly setValueAtTime: (value: number, time: number) => void
	readonly linearRampToValueAtTime: (value: number, time: number) => void
}

export const scheduleGain = (
	param: GainParam,
	gain: GainChange,
	from: number,
): void => {
	if (gain.start === gain.end) {
		param.setValueAtTime(gain.to, gain.start)
		return
	}
	param.setValueAtTime(from, gain.start)
	param.linearRampToValueAtTime(gain.to, gain.end)
}

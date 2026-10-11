# Audio engine

Reading view crossfades ambience when a cue crosses the middle of the viewport. The command "open audio" fires those same cues and extra looping overlays. Both use one engine and one current cue.

## What it does

- A cue is an HTML comment: `<!-- audio: ambient_dark_forest.mp3, volume: 0.7, crossfade: 2500 -->`. `loop` is optional and defaults to `true`. Volume is from 0 through 1. Crossfade is a non-negative number of milliseconds. The file is one path segment under the assets root.
- `parseCues` returns the valid cues in order. A bad audio comment is a `CueError` and a notice. It does not drop the valid cues and it does not throw.
- `planCrossfade` schedules two decks. From silence, one deck starts at the cue volume. A new file ramps the playing deck to 0 and the idle deck to the new volume, starting at the audio clock time and lasting the cue's crossfade. The same file changes volume only. Loop comes from the cue.
- The Web Audio edge applies that plan with `linearRampToValueAtTime`. A missing file or a decode failure is an `AudioError`, a notice, and the previous cue keeps playing. Buffers load from `${assets}/${file}`.
- Reading view inserts a sentinel for each cue, because comments are not in the rendered DOM. An `IntersectionObserver` whose root is a band at the vertical center plays that cue. Leaving preview, or opening another note, releases the reading holder and disconnects those observers.
- The audio leaf lists the active note's cues and can loop another asset as an overlay. Overlays are not a second current cue. Each running overlay has a volume slider, and the leaf has a master slider from 0 through 1. Closing the leaf releases the leaf holder and stops its overlays. If reading view is still holding the cue, that cue keeps playing.
- `onunload` stops playback, disconnects every node, and closes the `AudioContext`.

Neither surface writes a sidecar or a note.

## Not in this phase

Editor blocks.

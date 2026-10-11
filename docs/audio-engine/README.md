# Audio engine

Not started. Reading view can crossfade ambience as the reader moves through a chapter. A docked leaf can cue the same tracks by hand.

## Purpose

Authors mark a cue with an HTML comment:

```html
<!-- audio: ambient_dark_forest.mp3, volume: 0.7, crossfade: 2500 -->
```

In reading view, a cue that crosses the vertical center of the viewport fades the playing deck out and the next deck in. Two decks are enough. Loop and volume come from the cue. Files resolve under the vault's `/Assets` root.

The manual leaf mixes channels, overlays (rain, tavern, battle), and fires the same cues without scrolling.

## Exit criteria

- Cues are parsed with Schema. A bad comment is ignored and reported. It does not throw into the markdown renderer.
- `IntersectionObserver` instances, audio nodes, and buffer loads are registered on the plugin and released in `onunload` and when the leaf closes.
- Crossfade uses the Web Audio API. Gain ramps are scheduled on the audio clock. The code does not sleep to fake a fade.
- Closing the note or leaving reading view stops playback.

## Constraints

The soundboard and the reading-view observer share one engine. They do not keep separate notions of the current track.

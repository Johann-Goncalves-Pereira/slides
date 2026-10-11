# Editor blocks

Not started. Reading view and the editor surface the ledger without becoming a second source of canon.

## Purpose

- A CodeMirror `StateField` records wikilink targets in the open note. A `ViewPlugin` notices when those links change and notifies the extraction queue. Typing itself stays synchronous.
- Three markdown code blocks render from `rehydrateAt` for the note's coordinate:
  - `character-sheet` — attributes for one character
  - `rpg-event` — one ledger entry, with a control that requests removal of that event and a rebuild of the tail
  - `relationship-matrix` — affinity scores between characters

## Exit criteria

- Blocks read state. They do not write stat numbers back into the note body.
- React roots, if used, are created per container and unmounted on note change and on `onunload`.
- The wikilink tracker does not start an LLM call itself. It only reports the edit to the extraction phase.

## Constraints

Post-processors must not keep detached DOM nodes after the plugin unloads.

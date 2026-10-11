# Vault lifecycle

Not started. This phase indexes the vault and feeds the phase 1 `Ledger`. It does not call a model, draw a graph, or play audio.

## Purpose

Read an opinionated, configurable set of roots and turn markdown into initial state plus story events.

Default roots:

- `/Livro` — manuscript chapters and scenes
- `/Personagens` — character profiles and initial stat blocks
- `/Mundo` — spells, artifacts, factions, regions, lore
- `/Assets` — portraits, maps, and sound files

Chapter frontmatter carries `order`, `timestamp`, `act`, and `branchId`. Character notes supply the initial `WorldState` passed to `reduceWorld`. Events live in a JSON sidecar keyed by `eventId`, not by file path.

## Exit criteria

- A settings panel (or plugin data) can change the four roots.
- `metadataCache` and vault modify/rename/delete listeners rebuild only the affected notes.
- Rename keeps the note's stable id so historical events still resolve.
- Frontmatter that disagrees with the folded state is reported as drift and can append an `OVERRIDE_SYNC` event. Silent overwrite is not allowed.
- Every listener is registered with `this.registerEvent` and is gone after `onunload`.
- Deleting a chapter removes or tombstones its events without rewriting the rest of the vault.

## Constraints

No Git operations inside the vault. No direct mutation of character stat blocks when a later chapter changes them. State at a coordinate always comes from `rehydrateAt`.

# Vault lifecycle

The vault index lives in `src/domain/vault/`. Obsidian I/O stays in `src/vault/`. Prose is not parsed.

## What it does

- Plugin data stores the four roots. Missing data uses `Livro`, `Personagens`, `Mundo`, and `Assets`. A settings tab can change them.
- A character note is initial state: `noteId`, `name`, optional `characterId` (defaults to `name`), and `stats`. Editing those numbers changes the initial world. Chapters never write back into character notes.
- A chapter note is one coordinate. `order` is `chapterOrder`, with `timestamp`, `act`, and `branchId` (default `main`). `sceneIndex` and `beatIndex` are 0. Optional `overrides` are absolute stats.
- Events live beside the chapter as `Cap1.events.json`, keyed by `eventId`. A missing `noteId` is skipped until the adapter writes one id. A second metadata event does not write another.
- `Mundo` and `Assets` are listed only. They are not story state.
- Rename changes the path and moves the sidecar file. `noteId` and `eventId` stay.
- Delete tombstones that chapter's sidecar and leaves every other sidecar as it was.
- Chapter `overrides` that disagree with `rehydrateAt` are reported. The command "append override sync" writes one `OVERRIDE_SYNC` event. Nothing appends it on its own.

Listeners are `metadataCache` `changed`, plus vault `rename` and `delete`, each through `registerEvent`.

## Not in this phase

LLM extraction, editor blocks, the relationship HUD, and audio.

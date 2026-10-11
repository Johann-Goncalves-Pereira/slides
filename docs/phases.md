# Phases

Progress for the Writing plugin. Phase 1 is the pure story engine in `src/domain/story/`. Phase 2 reads the vault into that engine. Phase 3 asks a local model for events and appends them only after the author accepts. Phase 4 shows that canon in a side panel. Phase 5 crossfades ambience from cues in the note.

| Phase | Status | Directory | Exit criteria |
| --- | --- | --- | --- |
| 1. Event sourcing | Done | [event-sourcing](event-sourcing/README.md) | Schema-decoded events, ordered fold, branch-local snapshots, and `rehydrateAt` matching a full fold. |
| 2. Vault lifecycle | Done | [vault-lifecycle](vault-lifecycle/README.md) | Configurable `/Livro`, `/Personagens`, `/Mundo`, and `/Assets` roots. Metadata listeners feed the ledger. Rename keeps event ids. Frontmatter drift can append `OVERRIDE_SYNC`. Listeners clear on unload. |
| 3. LLM extraction | Done | [llm-extraction](llm-extraction/README.md) | Local model proposes atomic diffs. Decode failure leaves the ledger unchanged. The pause before a request is an interruptible Effect fiber. |
| Editor blocks | Done | [editor-blocks](editor-blocks/README.md) | Wikilink tracking plus `character-sheet`, `rpg-event`, and `relationship-matrix` blocks that read `rehydrateAt` and do not write canon back into the note. |
| 4. Relationship HUD | Done | [relationship-hud](relationship-hud/README.md) | Scrubber, character sheet, affinity graph, and radial charts for one coordinate. React and React Flow arrive with this phase. |
| 5. Audio engine | Done | [audio-engine](audio-engine/README.md) | Reading-view comment cues crossfade on two decks. A manual leaf shares that engine. Observers and audio nodes are released on unload. |
| Canon extensions | Done | [event-sourcing](event-sourcing/README.md) | World flags, projected status remaining, Mundo entities, membership, location, a layered relationship graph, and overlay volume on the shared audio engine. |

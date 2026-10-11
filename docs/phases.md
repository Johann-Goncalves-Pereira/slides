# Phases

Progress for the Writing plugin. Phase 1 is the pure story engine in `src/domain/story/`. Later phases are specified in their own directories and have no production code yet.

| Phase | Status | Directory | Exit criteria |
| --- | --- | --- | --- |
| 1. Event sourcing | Done | [event-sourcing](event-sourcing/README.md) | Schema-decoded events, ordered fold, branch-local snapshots, and `rehydrateAt` matching a full fold. |
| 2. Vault lifecycle | Not started | [vault-lifecycle](vault-lifecycle/README.md) | Configurable `/Livro`, `/Personagens`, `/Mundo`, and `/Assets` roots. Metadata listeners feed the ledger. Rename keeps event ids. Frontmatter drift can append `OVERRIDE_SYNC`. Listeners clear on unload. |
| 3. LLM extraction | Not started | [llm-extraction](llm-extraction/README.md) | Local model proposes atomic diffs. Decode failure leaves the ledger unchanged. The pause before a request is an interruptible Effect fiber. |
| Editor blocks | Not started | [editor-blocks](editor-blocks/README.md) | Wikilink tracking plus `character-sheet`, `rpg-event`, and `relationship-matrix` blocks that read `rehydrateAt` and do not write canon back into the note. |
| 4. Relationship HUD | Not started | [relationship-hud](relationship-hud/README.md) | Scrubber, character sheet, affinity graph, and radial charts for one coordinate. React and React Flow arrive with this phase. |
| 5. Audio engine | Not started | [audio-engine](audio-engine/README.md) | Reading-view comment cues crossfade on two decks. A manual leaf shares that engine. Observers and audio nodes are released on unload. |

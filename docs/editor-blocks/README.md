# Editor blocks

Reading view and the editor surface the ledger. They do not become a second source of canon.

## What it does

- `linkTracker` stores watched `Personagens/` and `Mundo/` targets in a CodeMirror `StateField`. Its `ViewPlugin` calls `wikilinkEdits` only when the document changes, then notifies the extraction queue with the new note text. The update stays synchronous and does not call the model.
- `ExtractionQueue.enqueue` leaves an in-flight pause running when the same chapter path is enqueued with the same text. A different text still replaces that pause. The metadata listener still indexes frontmatter, and it still enqueues a link edit that never passes through the open editor.
- Three markdown code blocks call `rehydrateAt` for the host chapter's coordinate:
  - `character-sheet` takes one character id and shows that character's sheet.
  - `rpg-event` takes one event id. The event is shown when it is on the same branch at or before the chapter. Remove drops that event from the sidecar that owns it. The note body is not edited. The next read folds the remaining tail.
  - `relationship-matrix` takes an empty body and lists every affinity at that coordinate, sorted by subject, object, and axis.
- A block whose host is not a live chapter shows a notice and no stats.
- Each block mounts one React root through a `MarkdownRenderChild`. The root unmounts when that child unloads, and any root still mounted unmounts from `onunload`.

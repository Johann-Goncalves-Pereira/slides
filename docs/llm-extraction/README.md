# LLM extraction

A local model proposes story events. The author accepts or rejects them before they join a chapter sidecar.

## What it does

- `wikilinkEdits` reports added and removed `Personagens/` and `Mundo/` targets. Other links are ignored.
- `splitBeats` splits a chapter on `---`, `***` / `* * *`, and `<!-- beat -->`. Scene breaks increment `sceneIndex` and reset `beatIndex`. Beat breaks increment `beatIndex`. The chapter's order, timestamp, and branch id are copied onto every beat.
- `decodeProposal` maps model JSON into story events. `"Arthur->Merlin"` with `{ "trust": -5 }` becomes `targetEntity: "Arthur"`, `object: "Merlin"`, `axis: "trust"`, `delta: -5`. A structured stat change passes through. Missing event ids are assigned. `OVERRIDE_SYNC`, an unknown type, or an event id already in the sidecar fails the batch and leaves the sidecar unchanged.
- `ExtractionQueue.enqueue` records the latest chapter text and forks an interruptible pause. A newer enqueue with different text interrupts the previous fiber. The same chapter text leaves that pause running. The caller returns before the model answers. The pause is `Effect.sleep` inside that fiber. The default is 30 seconds.
- Accept appends the decoded events to that chapter's sidecar and clears the proposal. Reject clears it and writes nothing. A second accept does not append again.
- `src/api/api-client.ts` is the only module that calls `fetch`. It posts to Ollama `/api/chat` with a JSON schema `format` and reads `message.content`.
- Plugin data stores the model base URL (`http://127.0.0.1:11434`), model name (`qwen2.5:1.5b`), and pause beside the vault roots. The settings tab can change them.
- A watched link edit on a chapter enqueues after the pause. The first time a chapter is seen, the text is stored and no request is sent. "extract chapter" enqueues the active note immediately.
- A modal lists the proposed diffs with Accept and Reject. The same two actions are commands for the active file.
- The queue's fibers live in one scope closed from `onunload`. Vault listeners stay on `registerEvent`.

A decode or transport failure is `ExtractionError` or `ModelError`, a notice, and the same sidecar events as before.

## Not in this phase

Editor blocks, the relationship HUD, and audio.

# LLM extraction

Not started. A local model proposes story events. The author confirms them before they join the ledger.

## Purpose

When a wikilink such as `[[Personagens/Arthur]]` or `[[Mundo/Excalibur]]` is added, edited, or removed, wait until the writer pauses, then ask Ollama (or another local server) for atomic diffs. A finished chapter can also be split on `---`, scene breaks, or beat tags and extracted in the background.

The model emits only `STAT_CHANGE`, `AFFINITY_SHIFT`, `INVENTORY_MUTATION`, and `STATUS_EFFECT` diffs. It must not return a full character profile. Stringly affinity targets such as `"Arthur->Merlin"` with `{ "trust": -5 }` are mapped into `targetEntity`, `object`, `axis`, and `delta` before `decodeStoryEvent`.

## Exit criteria

- One client module owns the HTTP call. Domain code does not use `fetch`.
- Output is constrained by the server's JSON schema or grammar, then decoded with `decodeStoryEvent`. A decode failure is a tagged error, a notice in the plugin UI, and an unchanged ledger.
- The pause before a request is an interruptible Effect fiber. A newer edit cancels the in-flight wait. The implementation does not use `setTimeout` plus a floating promise.
- Extraction never blocks typing. The editor thread only enqueues work.
- Accepted events are appended. Rejected proposals are dropped. Nothing in the ledger is rewritten in place.

## Constraints

Malformed JSON does not crash the editor and does not drop events that were already accepted.

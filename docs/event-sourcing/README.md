# Event sourcing

Phase 1 ships the pure story engine in `src/domain/story/`. Vault I/O, LLM extraction, and UI are not part of this module.

## Public seams

- `decodeStoryEvent` / `decodeWorldState` validate untrusted payloads with `effect/Schema`.
- `compareCoordinates` orders `{ branchId, chapterOrder, sceneIndex, beatIndex, timestamp }`. `branchId` defaults to `"main"`.
- `compareEvents` uses that order, then `eventId`, so two changes in the same beat have one order.
- `reduceWorld(initial, events)` sorts, then folds. It returns `Effect`, and fails with `UnknownEntity` or `InsufficientQuantity` instead of throwing.
- `buildSnapshots(initial, events, policy)` checkpoints a branch after every `everyNEvents` events and after a chapter whose `chapterOrder` is a positive multiple of `everyNChapters`. The named default is 250 events and 25 chapters.
- `rehydrateAt(coordinate)` asks a `Ledger` for the latest snapshot at or before that coordinate on the same branch, then folds the strict tail. Other branches are ignored.

A snapshot contains every event at or before its coordinate. Replay starts after that coordinate. Rehydrating from the snapshot equals folding the branch from the initial world.

## Event shapes

Characters must already exist on the initial `WorldState`. The engine does not create them.

- `STAT_CHANGE` carries a non-empty map of stat name to finite delta. A missing stat starts at 0. Totals may go below 0.
- `AFFINITY_SHIFT` updates `targetEntity` (the subject) toward `object` on `axis` by `delta`.
- `INVENTORY_MUTATION` is `ADD` or `REMOVE` of `itemId`, `name`, and a positive `quantity`. Removing more than held fails.
- `STATUS_EFFECT` is `APPLY` or `CLEAR`. A second `APPLY` of the same name replaces `durationScenes`. Duration is stored and not counted down.
- `OVERRIDE_SYNC` sets the named stats to absolute values. Other stats stay as they were.
- `FLAG_SET` sets one world flag to a boolean. Setting it again replaces that boolean. A flag that has never been set is absent.
- `MEMBERSHIP` joins or leaves a faction that already exists. Joining twice, or leaving when absent, leaves the membership list as it was.
- `LOCATION_SET` sets a character's region. The region must already exist. A later set replaces it.

## Not in this phase

- **Path identity.** Events are keyed by `eventId`. When a chapter file is renamed, a vault adapter must keep that id and update any path metadata. The reducer never uses a vault path as identity.
- **`OVERRIDE_SYNC`.** A chapter may record absolute stats in `overrides`. When those numbers disagree with the fold, the vault layer reports the drift. The command "append override sync" writes an `OVERRIDE_SYNC` event that sets those stats. The reducer does not invent the event, and character notes are not rewritten.
- **Status remaining.** `APPLY` stores `durationScenes` and the coordinate where it was applied. The fold does not count scenes down. A read subtracts each later scene, including the coordinate being read, and drops the status at zero. A status with no duration, or an older status with a duration and no apply coordinate, does not expire.

# Relationship HUD

A side panel shows canon at one story coordinate. Scrubbing does not write a sidecar, a character note, or an event.

## What it does

- `storyStops` lists the origin and each non-tombstoned chapter coordinate on one branch, in story order, without duplicates. The scrubber is an index into that list. A branch select switches the list.
- The view builds a ledger with `ledgerFromIndex` and calls `rehydrateAt`. A failure is a notice. The world already on screen stays there.
- `projectSheet` shows that character's stats, inventory, statuses, and affinities. An SVG radar uses the character's stat names, sorted.
- `projectGraph` draws character nodes, item nodes, and a node for an affinity object that is not a character. Affinity edges carry `axis` and `score`. Holds edges carry `quantity`. Nodes do not store color, motion, or score. `affinityTone` maps the score to a color and a motion name when the edge is drawn.
- `layoutGraph` returns positions. The same graph always gets the same positions, and the input graph is left unchanged. The view does not call it. A blob worker runs the function's source and posts positions back. The worker terminates in `onClose` and again in `onunload`.
- The panel is an Obsidian `ItemView` opened with "open relationship hud". React and React Flow render the sheet and the graph. The React root unmounts in `onClose` and any root still open unmounts in `onunload`.
- Colors are ebony `#0B0F19`, wood `#1E1611`, metal `#D4AF37`, cyan `#00E5FF`, and violet `#A855F7`. Titles are serif. Controls are sans-serif.

The ledger has no faction or membership event, so the graph does not invent faction nodes. Artifacts are inventory items.

## Not in this phase

Editor blocks and audio.

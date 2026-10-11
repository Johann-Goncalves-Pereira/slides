# Relationship HUD

Not started. A side panel shows canon at a chosen story coordinate.

## Purpose

- A timeline scrubber selects a `StoryCoordinate`. The panel calls `rehydrateAt` and renders that world.
- A character sheet shows stats, inventory, statuses, and affinities at that coordinate.
- A relationship graph shows characters, factions, and artifacts. Edge labels are affinity axes and scores. Item and membership edges show who holds or belongs to what at that coordinate.
- Radial charts show a fixed set of attributes for the selected character.

Visual baseline from the product note: ebony `#0B0F19`, wood `#1E1611`, metal `#D4AF37`, cyan `#00E5FF`, violet `#A855F7`. Serif titles, sans-serif controls.

## Exit criteria

- Scrubbing never mutates the ledger. Moving the slider only changes the coordinate passed to `rehydrateAt`.
- Graph layout runs off the main thread. Node and edge types are Schema-decoded. No `any`.
- React and React Flow are added to the build only when this phase starts. The esbuild config gains a JSX transform then, not before.
- The view is an Obsidian `ItemView`. Its React root unmounts in `onClose` and again in `onunload`.

## Constraints

Affinity color and motion describe the score. They are not a second copy of the score stored on the node.

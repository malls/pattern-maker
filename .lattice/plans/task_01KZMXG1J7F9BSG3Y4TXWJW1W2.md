# PM-8: Export / save / copy-css with a live float: stamp it first?

## Reset 2026-08-11 by human:forrest

Decision reversed: fix it. Explicit user actions must export what's on screen.

## Change

`src/main.ts` only: call the existing `commitFloatFirst()` (stamps a live floating
paste via `stampFloatAction`, no-op otherwise) at the top of the three explicit
output actions:

- `doSave()` (line ~461)
- `doCopyCss()` (line ~502)
- `doExportPng()` (line ~521)

Autosave deliberately does NOT stamp — a debounced timer must never mutate the
document. Stamping bumps `dirtyDoc`, so previews and the autosave itself refresh
naturally after the stamp; the stamp is one undo entry exactly as if the user
pressed Enter, and the selection re-selects the stamped bounds per existing behavior.

## Acceptance criteria

- With a float live: Export PNG / Copy CSS / Save each include the floated pixels
  (the stamp happens first); the float is gone afterward and one undo entry restores
  the pre-stamp state.
- With no float: the three actions behave byte-identically to before.
- Autosave path untouched (no commitFloatFirst in the subscriber).
- tsc + build clean; only src/main.ts modified.

Complexity: low.

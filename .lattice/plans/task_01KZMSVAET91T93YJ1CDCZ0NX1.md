# PM-6: Arbitrary integer cell size (1-64) + scale up UI to waste less space

Human-requested. Two independent UX changes; complexity: low.

## 1. Arbitrary integer cell size

Today `src/state/doc.ts` exports `CELL_SIZES = [8, 12, 16, 24, 32, 48, 64]` and the
toolbar stepper (`src/ui/toolbar.ts`) walks that list. Replace with any integer 1–64:

- `doc.ts`: drop `CELL_SIZES`; export `MIN_CELL = 1`, `MAX_CELL = 64`, and
  `clampCell(n) = Math.min(MAX_CELL, Math.max(MIN_CELL, Math.round(n)))`.
  `setCellSize` already handles arbitrary dims via `resizeNearest` — verify, don't rewrite.
- `toolbar.ts` stepper: minus/plus step ±1 (clamped); Shift+click steps ±8. The readout
  becomes click-to-edit: clicking swaps in a numeric input (mono, same width); Enter or
  blur commits `clampCell(parsed)` (non-numeric → revert), Esc cancels. Keep the
  three-digit zero-padded display. Stepper keys get `aria-label`s ("smaller cells",
  "larger cells"); input gets `aria-label` "cell size in pixels".
- Everything downstream (slice math = cellSize, previews, exports, persistence schema,
  undo resample invariant, focus window Lf=C) already parameterizes on `doc.cellSize`;
  the implementer greps for any other `CELL_SIZES` consumer (persist decode validation
  may whitelist the old list — if so, replace with 1–64 range check) and verifies odd
  sizes (e.g. 13) end-to-end.

## 2. Scale up the UI

Footprint stays independent of cell size (PM-4 invariant) but should use more viewport:

- `src/styles/app.css` `.device`: `width: min(1180px, 100%)` → `min(1400px, 100%)`.
- `.bezel`: `height: 560px` → `height: clamp(560px, calc(100dvh - 300px), 920px)`
  (fallback line with `100vh` before it for older engines). The ≤880px media block keeps
  its 320px. The editor already relayouts via ResizeObserver (grid-editor.ts:324), so a
  viewport-height change reflows correctly — verify by reading, no logic change expected.
- Preview column: allow it to breathe at the new width (if it has a fixed max, raise it
  proportionally; keep border-preview boxes their current size, more gap is fine).
- Do NOT enlarge key caps, type, or LCD — "scale up a bit" means less dead space, not a
  bigger control chrome.

## Acceptance criteria

- Cell size accepts any integer 1..64 via +/- (±1), Shift+±8, and direct typed entry;
  out-of-range and garbage input clamp/revert; LCD + stepper readout stay in sync.
- Size 13 (odd, non-power-of-2) works end-to-end: draw both modes, focused zoom, undo
  across a size change, save/load round-trip, PNG + CSS export (slice: 13), previews.
- On a tall/wide desktop viewport the device is wider (up to 1400px) and the bezel
  taller (up to 920px); on a short viewport nothing regresses (560px floor, 320px mobile).
- Cell-size changes still never change the UI footprint.
- `npx tsc --noEmit` && `npm run build` clean.

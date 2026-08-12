# PM-22: Mobile: color chips overflow the device panel + horizontal scroll

## Diagnosis (reproduced under Playwright mobile emulation: iPhone 13/SE, Pixel 7, 320px)

Every emulated phone shows scrollWidth 536 vs viewport 320–412. The offender is the
deck's color cluster: `src/ui/chips.ts:91` builds it as `.tb-group` (label + current
well + palette stepper + 16-chip grid + custom picker = 511px at coarse-pointer sizes),
but PM-21's ≤640 wrap rule is scoped `.toolbar .tb-group` — the deck's group is not in
the toolbar, keeps the base nowrap, overflows the device panel, and mobile browsers
expand the layout viewport to fit (hence chips rendering past the panel edge AND
page-wide horizontal scroll; innerWidth reads 536).

## Fix

1. `src/styles/app.css` ≤640 block: `.toolbar .tb-group { flex-wrap: wrap }` →
   `.tb-group { flex-wrap: wrap }` (the toolbar groups keep wrapping; the deck's
   color group joins them — internally it wraps to [label, well, stepper] /
   [chips, custom], and the chip grid itself is 248px, which fits every viewport
   ≥ 320px).
2. Belt-and-braces: `html, body { overflow-x: clip }` in the base styles — if any
   future rule overflows again it must not re-expand the mobile layout viewport.
   (`clip`, not `hidden`: no scroll container is created.)

## Verification (Playwright, emulated; scratchpad script, not committed)

- iPhone 13 / iPhone SE / Pixel 7 / 320×700: `document.scrollingElement.scrollWidth
  == documentElement.clientWidth`, innerWidth == device width, zero elements with
  rect.right > viewport (excluding elements inside overflow-clipped ancestors like
  the LCD), and every `.chip`'s rect contained within the `.device` rect.
- Desktop 1400×900 mouse: layout byte-identical (probe key geometry before/after).
- tsc + build clean.

Complexity: trivial (one selector + one guard) — the work was the diagnosis.

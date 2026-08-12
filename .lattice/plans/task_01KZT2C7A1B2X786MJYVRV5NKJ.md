# PM-21: Mobile web: canvas container grows endlessly + controls don't fit small screens

Complexity: medium. Two independent problems: (A) a genuine layout feedback loop that only
manifests at ≤880px, (B) fixed-width content that overflows narrow viewports. Desktop-first
product: the fix is surgical CSS + a measurement correction, not a mobile redesign.

## Part A — Root-cause diagnosis of the endless-growth loop

### The seed: layout() measures the border-box but only subtracts padding

`src/editor/grid-editor.ts`:

- Line 48: `const BEZEL_PAD = 8;` — comment says "the bezel's 8px", subtracted when measuring.
- Lines 94–96: `layout()` reads `container.getBoundingClientRect()` (the **border-box**) and
  computes `cssW = rect.width - BEZEL_PAD * 2` (and same for height).
- But `.bezel` (app.css:208–221) has `padding: 8px` **and** `border: 1px solid` with global
  `box-sizing: border-box` (app.css:1). Its content box is `rect - 16 (padding) - 2 (border)`,
  i.e. `rect - 18`. `layout()` subtracts only 16.
- Lines 97–102 then set `canvas.style.width/height` to that value (floored to whole device px).

**Result: the canvas is always set ~2px wider and taller than the bezel's content box.**

### The amplifier: flex automatic minimum size in the ≤880px column layout

- `app.css:406–407`: at ≤880px, `.panel { flex-direction: column }`. `.bezel` becomes a flex
  item whose **main axis is vertical**.
- `.bezel` has `min-width: 0` (app.css:210) — that was the guard for the desktop **row** layout,
  where the main axis is horizontal. There is **no `min-height: 0`**.
- Per the flexbox spec, a flex item's `min-height: auto` in a column container resolves to its
  content-based minimum size. `.bezel` is a grid container whose only child is the canvas with
  an explicit CSS height, so its min-content height = canvas height + 16 (padding) + 2 (border).
- `.bezel { height: 320px }` (app.css:409) is therefore only a *preferred* size; the used height
  is `max(320px, canvasH + 18)`.

### The cycle (+2px per ResizeObserver tick, forever)

1. Bezel used height 320 → `layout()` sets canvas height to `320 − 16 = 304`.
2. Bezel min-content height = 304 + 18 = **322** → flex auto-min grows the bezel to 322.
3. ResizeObserver on the container (grid-editor.ts:411–415) fires → `needLayout = true` →
   `layout()` re-measures 322 → canvas = 306 → bezel min = 324 → … monotonic, unbounded.

### Why mobile-only, and the aggravators

- **Desktop (row `.panel`)**: main axis is horizontal and `min-width: 0` kills the width channel;
  height is the cross axis, where auto-min doesn't apply — the 2px error just makes the canvas
  silently overflow the bezel's content box by 1px per edge. Latent bug, no loop.
- **≤880px (column `.panel`)**: main axis is vertical, no `min-height: 0` → loop. This reproduces
  in ANY browser window ≤880px CSS-wide — no phone needed.
- **DPR 3** (suspected in the report): only changes the step size — `floor(cssH·3)/3` makes growth
  ≈ +1.67–2px/tick instead of exactly +2. Not the cause.
- **dvh** (app.css:212–213): only applies >880px, so it is not part of this loop; but on tablets /
  landscape phones >880px the URL-bar show/hide changes `100dvh`, which resizes the bezel, which
  resets `canvas.width` (clearing and redrawing the canvas) on every scroll direction change —
  bounded thrash, worth fixing in the same pass (→ `svh`).

## Part B — Why controls don't fit narrow viewports

Fixed-width, non-wrapping content forces the device wider than the viewport → horizontal page
scroll. At 390px CSS (iPhone-ish), the fixed overhead is body padding 44 (app.css:12) + device
padding 36 (app.css:31). Offenders, largest first:

1. **Output previews** (`app.css:238–257`, `src/preview/border-preview.ts:41–56`): `.bp-box` is
   fixed 158px; two columns + 12px gap = 340px. Worse, the "repeat 2×" study sets **inline**
   `width/height = max(158, cellSize·4 + 64)` — up to **320px** at MAX_CELL=64 (doc.ts:17).
   340 + 80 overhead = 420px minimum > 390.
2. **Toolbar tool group** (`app.css:150–153`, toolbar.ts:58–77): `.toolbar` wraps but `.tb-group`
   does not — the 8-key group is one rigid unit: 8×46px + 7×6px gap + label ≈ 415px.
3. **Transport** (`app.css:331`): no wrap; 7 t-keys ×52px + scale stepper + gaps ≈ 480px.
4. **Masthead** (`app.css:58–64`): no wrap; wordmark + model + tagline + two links + power dot.
5. **LCD** (`app.css:378–392`): `nowrap; overflow: hidden` — it clips rather than overflows (OK),
   but at 320px the tip is fully consumed by the fixed segments.

Breakpoint audit: **880px is the only responsive breakpoint** (app.css:406). The `.pos` hide the
task mentions lives there (line 411); **no 720px block exists** — nothing to reconcile, just
noting the task's assumption was stale.

Touch audit: canvas already `touch-action: none` (app.css:226). Tool keys 46×42 and t-keys
(52×34 cap + label ≈ 52×48 total button) are acceptable. Too small for touch: mode keys 58×26,
cell stepper keys 30×26, palette/scale stepper keys 26×26/26×34, chips 19px, custom well 19px.

## The fix (minimal robust combination)

Three independent guards for the loop — any one alone stops unbounded growth; together they make
the invariant structural:

1. **Measure correctly** (grid-editor.ts): use `container.clientWidth/clientHeight` (padding box —
   excludes border, and is what `BEZEL_PAD` was written against) instead of
   `getBoundingClientRect()`. The canvas can then never exceed the content box, so it can never
   raise the bezel's min-content size above its specified size. (clientWidth rounds to integers —
   worst case ±0.5px vs the true fractional box; harmless given guards 2 and 3.)
2. **Close the flex channel** (app.css `.bezel`): add `min-height: 0` beside the existing
   `min-width: 0`, plus `contain: size` — which encodes the documented sizing model directly
   ("the canvas always fills the bezel's inner box, a fixed footprint set in CSS",
   grid-editor.ts:5–7): with size containment the bezel's size is computed as if it were empty,
   so no child can ever feed back, even after future refactors. (`contain: size` needs Safari
   15.4+; older engines still have guards 1 and 3.)
3. **No-op re-entry guard** (grid-editor.ts `layout()`): skip the `canvas.width/height/style`
   writes when the computed device size and DPR are unchanged. This is NOT the loop fix (in the
   loop the size *does* change each tick) — it prevents pointless canvas clears + full redraws
   when the RO fires without a real size change, and makes any residual cycle converge instead
   of oscillate.

Plus **`svh` instead of `dvh`** for the bezel height everywhere viewport-relative: `svh` is the
small (URL-bar-visible) viewport and is **stable during scroll** — the canvas never resizes or
clears when browser chrome hides/shows. Cost: the bezel is a few % shorter when chrome is hidden;
the letterboxed canvas absorbs that invisibly. (`dvh` would re-trigger resize thrash on every
scroll — exactly what the report suspected.)

## Per-file changes

### 1. `src/editor/grid-editor.ts`

- `layout()` lines 94–96: replace the `getBoundingClientRect()` measurement with
  ```ts
  const cssW = Math.max(32, container.clientWidth - BEZEL_PAD * 2);
  const cssH = Math.max(32, container.clientHeight - BEZEL_PAD * 2);
  ```
- Lines 97–102: compute `newDevW/newDevH` first; only when `newDevW !== devW || newDevH !== devH`
  (or first run) assign `canvas.width/height` and `canvas.style.width/height`. Everything after
  (z, ox/oy, checker, `laidOutL`, `needLayout = false`) still runs unconditionally — focus and
  cell-size changes flow through `needLayout` and must recompute z even when the box is unchanged.
- Update the line-47 comment: clientWidth is the padding box, so only the 8px padding is
  subtracted; the 1px border is already excluded.
- No changes to the RO (411–415), pointer math (`toArt` uses the canvas's own rect — unaffected),
  or DPR watcher.

### 2. `src/styles/app.css`

- `.bezel` (208–221): add `min-height: 0;` and `contain: size;`. Change line 213
  `100dvh` → `100svh` (keep the line-212 `100vh` fallback; update the line-211 comment).
- ≤880 block (406–412): replace `.bezel { height: 320px }` with
  ```css
  .bezel { height: clamp(240px, 45vh, 420px); height: clamp(240px, 45svh, 420px); }
  ```
  (viewport-relative so tall phones get more canvas; svh = loop- and scroll-safe.)
- **New `@media (max-width: 640px)` block** (compact pass; 880 block keeps doing the stacking):
  ```css
  body { padding: 10px; }
  #app { min-height: calc(100vh - 20px); }
  .device { padding: 12px 10px 10px; gap: 10px; }
  .masthead { flex-wrap: wrap; }
  .tagline { display: none; }              /* decorative; frees the masthead row */
  .toolbar { gap: 10px 14px; }
  .toolbar .tb-group { flex-wrap: wrap; }  /* the 8-key tool bank wraps to fit */
  .deck { gap: 10px; }
  .transport { flex-wrap: wrap; row-gap: 8px; }
  .bp-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .bp-box { width: 100%; max-width: 158px; height: auto; aspect-ratio: 1 / 1; }
  .lcd { gap: 8px; padding: 7px 10px; }
  .lcd .seg-out, .lcd .seg-focus, .lcd .seg-sel { display: none; }
  ```
  (Flexible `.bp-box` gives up "158px is deliberately not a multiple of any slice" on phones —
  accepted trade-off, noted in a comment; desktop keeps 158px exactly.)
- **New `@media (pointer: coarse) and (max-width: 880px)` block** (touch targets; never affects
  desktop, even narrow desktop windows):
  ```css
  .mode-bank .key { height: 34px; }
  .stepper .key { width: 36px; height: 34px; }
  .pal-stepper .key { width: 34px; height: 34px; }
  .t-scale .key { width: 34px; }
  .chips { grid-template-columns: repeat(8, 24px); grid-auto-rows: 24px; gap: 8px; }
  .custom { width: 24px; height: 24px; }
  ```
  Justified exceptions to the 44px guidance (desktop-first brand, spacing compensates):
  tool keys 46×42; t-key buttons ≈52×48 including their label; chips 24px at 32px pitch;
  mode/stepper keys 34–36px. Everything interactive lands ≥34px with ≥6px gaps.

### 3. `src/ui/lcd.ts`

- Lines 64–66: add classNames to the three wrapper spans — `seg-out`, `seg-focus`, `seg-sel` —
  so the ≤640 block can hide them (keeping tool / mode / cell / tip, the ones that matter while
  drawing). `.pos` already has its class and is hidden at ≤880.

### 4. `src/preview/border-preview.ts`

- `update()` lines 52–53: the 2× study currently sets inline `width/height` up to 320px (inline
  styles defeat any stylesheet override). Change to:
  ```ts
  twoBox.style.width = `min(${size}px, 100%)`;
  twoBox.style.height = "auto";
  twoBox.style.aspectRatio = "1 / 1";
  ```
  Desktop output column is 440px wide, so `min(…, 100%)` resolves to the same `size` as today —
  no desktop change. Update the adjacent comment.

## Implementation order (app runnable after every step)

1. grid-editor.ts: clientWidth measurement + no-op guard. *(Kills the loop's seed.)*
2. app.css: `.bezel` `min-height: 0` + `contain: size` + svh swap + ≤880 svh clamp.
   *(Loop structurally impossible; scroll-thrash gone.)*
3. app.css ≤640 compact block + lcd.ts segment classes. *(Controls fit.)*
4. border-preview.ts 2×-study sizing + `.bp-grid`/`.bp-box` rules. *(No horizontal scroll.)*
5. Coarse-pointer touch-target block.
6. `npm run typecheck` + verification below.

## Acceptance criteria

1. **Loop dead**: with the window (or DevTools device emulation, 390×844 DPR 3) at ≤880px CSS
   width, `document.querySelector(".bezel").offsetHeight` sampled every frame for 3s (≈50+ RO
   opportunities) is constant after the first layout — no monotonic growth. (Reproduce first on
   the unfixed build the same way: it grows ~2px/tick.)
2. **Containment**: canvas box never exceeds the bezel content box —
   `canvas.offsetWidth ≤ bezel.clientWidth − 16` and same for height, at 320/390/640/880/1400px.
3. **No horizontal scroll**: `document.documentElement.scrollWidth ≤ window.innerWidth` at 320,
   390, 640, and 880px widths, in both modes, at cell size 64 (the 320px-study worst case), with
   the output previews visible.
4. **No scroll-thrash**: zero `dvh` tokens remain in app.css; on a real phone, collapsing the URL
   bar does not clear/redraw the canvas (visually: no flicker while scrolling).
5. **Touch targets**: on coarse-pointer ≤880px every interactive control measures ≥34px in its
   smaller dimension (with the justified-exception list above); nothing is unreachable.
6. **Desktop unchanged**: at ≥900px the only rendering difference vs today is the canvas being
   2px smaller (it no longer overflows the bezel's content box by 1px per edge) and `svh` in
   place of `dvh` (identical when browser chrome is static). Toolbar/deck/LCD/output pixel-
   identical.
7. `npm run typecheck` passes; draw / focus / cell-size / mode / undo all still work (the layout()
   guard must not skip z/checker recomputation on focus or cell-size change — test `z` key and
   cell stepper specifically).

## Verification: headless vs phone

- **Headless / desktop-verifiable**: criteria 1–3, 6, 7 all reproduce in a normal desktop browser
  window or DevTools responsive mode — the loop is a flexbox behavior, not a mobile-browser one.
  A console snippet polling `bezel.offsetHeight` proves stability. The measurement arithmetic
  (clientWidth − 16 ≤ content box, canvas can't raise min-content above specified height) is
  verifiable by code reading; no test runner exists in this project (vite + tsc only) and adding
  one is out of scope.
- **Real-phone pass needed**: criterion 4 (URL-bar collapse — emulators don't model dynamic
  browser chrome), criterion 5 ergonomics (actual finger use of steppers/chips), and general
  feel at DPR 3. Note for the reviewer: `pointer: coarse` blocks won't activate in plain desktop
  DevTools unless device emulation is on.

## Risks

- `clientWidth` is integer-rounded: at fractional layout sizes the canvas can be ~0.5px off the
  true content box. Guards 2/3 make this loop-proof; letterboxing absorbs it visually.
- `contain: size` / `aspect-ratio` / `svh` need Safari ~15.4+. Older engines: `min-height: 0`
  and the measurement fix still prevent the loop; `vh` fallback lines cover bezel height; the 2×
  study box falls back to a non-square-but-clamped box (cosmetic).
- Flexible `.bp-box` on ≤640 loses the "deliberately non-multiple 158px" property that makes
  repeat/round/space visibly differ — accepted for phones; desktop unchanged.
- The layout() no-op guard must not skip zoom/checker recomputation (focus & cell-size paths) —
  called out in acceptance criterion 7.

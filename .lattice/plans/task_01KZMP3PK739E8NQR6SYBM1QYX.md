# PM-4: Fixed editor footprint + zoom-to-one-cell detail editing

Self-contained plan. Ground truth: the PM-3 implementation is live and matches its plan (`task_01KZMKJV0YMKXHFX6MAR5J37AN.md`). Read `BRANDING.md` §5–8 before touching UI. All paths below are relative to the repo root.

## 0. What exists today (read before changing)

- `src/editor/grid-editor.ts` — `layout()` sizes the **canvas element to the art**: `z = max(1, floor(avail·dpr / L))`, then `canvas.width = canvas.height = L·z` and CSS size `L·z/dpr`. So changing `cellSize` changes the canvas's on-screen size (e.g. bezel inner ≈ 544px: cell 8 → 528px canvas, cell 64 → 384px canvas). The bezel (`.bezel`, `min-height: 560px`, `flex: 1`, `display: grid; place-items: center`) centers whatever the canvas happens to be.
- Pointer mapping (`toPt`) divides by `rect.width` — it assumes canvas == art, no offsets.
- All tools speak **logical view coordinates** (`Pt`) through `ToolContext` (`src/tools/types.ts`); mode semantics (border center lock, tile torus via `mod`) live in `src/state/doc.ts` (`plotView`, `getViewPx`, `floodView`). This seam is why focus mode needs **zero tool changes**.
- `AppState` (`src/state/store.ts`) has no view state beyond `hover`.
- Chrome (`src/editor/chrome.ts`) draws checker/delineation/center-lock assuming the art starts at canvas origin `(0,0)`.
- History is buffer-snapshot based and coordinate-free; persistence stores buffers only. Neither needs changes.

## 1. Scope

**Delivers:**
1. **Fixed footprint:** the editor (bezel + canvas) has a constant on-screen size regardless of `cellSize`. The canvas fills the bezel's inner box; the art is drawn centered inside it at the **largest integer device-pixel zoom that fits**, letterboxed on the charcoal. Changing cell size changes resolution only.
2. **Zoom-to-one-cell focus (both modes):** the user focuses one cell of the 3×3 grid and edits it at high zoom. Border mode: the center cell **cannot be focused** (it is locked; rejecting focus is simpler and clearer than rendering a read-only hatch at full zoom — decision, do not relitigate). Tile mode: the focused cell is the tile; strokes crossing its edge wrap to the opposite side (torus), previews keep updating live. All tools, Alt-pick, fill, undo/redo work identically while focused.

**Explicitly out of scope:** free zoom/pan, per-pixel gridlines at high zoom, focus persistence across reloads, touch pinch gestures, double-click-to-focus (see §4 for why).

## 2. The sizing model (requirement 1)

**Footprint is fixed by CSS; zoom is derived, never the other way round.**

- `.bezel` gets a definite height: `height: 560px` (replace `min-height: 560px`); in the `max-width: 880px` media block, `height: 320px` (replace `min-height: 320px`). Width is already `flex: 1` and independent of cell size. The bezel *is* the editor's footprint.
- The canvas fills the bezel's inner box (bezel padding 8px stays). `layout()` becomes:
  1. `dpr = window.devicePixelRatio || 1`.
  2. Measure the bezel: `rect = container.getBoundingClientRect()`; inner CSS box `cssW = max(32, rect.width − 16)`, `cssH = max(32, rect.height − 16)`.
  3. Backing store in whole device pixels: `devW = floor(cssW · dpr)`, `devH = floor(cssH · dpr)`; `canvas.width = devW; canvas.height = devH`; pin the element to exactly that many device pixels: `canvas.style.width = (devW / dpr) + 'px'`, same for height. (Sub-CSS-pixel slack vs. the bezel inner box is ≤ 1/dpr px and does not depend on cellSize — the footprint reads as fixed. The bezel keeps `place-items: center` so the slack is symmetric.)
  4. Focused logical size: `Lf = focus ? C : 3C` (C = `doc.cellSize`, L = `3C`).
  5. **Integer device zoom:** `z = max(1, floor(min(devW, devH) / Lf))`.
  6. **Centered letterbox offsets (device px):** `ox = floor((devW − Lf·z) / 2)`, `oy = floor((devH − Lf·z) / 2)`.
  7. Checker cache canvas resized to `Lf·z × Lf·z`, redrawn via existing `drawChecker(checkerCtx, Lf, z)` (unchanged signature).
- Non-integer answer, decided: **largest integer device-pixel zoom that fits, centered, letterboxed**. The letterbox is simply the transparent canvas showing the charcoal bezel through it (canvas background stays transparent) — clear the full canvas each render, draw checker + art + chrome only inside the art rect. No half-pixel scaling ever: source is drawn with `imageSmoothingEnabled = false` at exactly `Lf·z` device px.
- Overflow note: `devW/devH ≥ ~288` device px on the smallest supported layout while `Lf ≤ 192`, so `z ≥ 1` always fits. Keep the `max(1, …)` guard anyway; if a pathological container ever makes `Lf·z > dev`, `ox/oy` go negative and the art is center-cropped by the canvas — acceptable degenerate, no special code.
- Invalidation: existing `ResizeObserver` on the bezel and the `matchMedia` DPR re-arm trick stay as-is. Add `focus` to the store-subscription relayout condition (see §5). `cellSize` changes already set `needLayout`.

## 3. Focus state model

`src/state/store.ts` — add to `AppState`:

```ts
/** zoom-to-one-cell: which 3×3 cell is focused, or null (whole view) */
focus: { cx: number; cy: number } | null;   // cx, cy ∈ {0,1,2}
```

Rules (enforced in `main.ts` actions, the only writers):
- **Border mode: `(1,1)` is never a legal focus value.** `enterFocus` rejects it with tip `center's locked. pick a live cell`.
- **Tile mode: any cell may be focused** (all nine map to the same tile; the choice only affects which letterbox position the mini-map highlights).
- **Mode switch clears focus** (`setMode` sets `focus: null`) — predictable, and sidesteps border-center legality when arriving from tile mode.
- **Cell-size change keeps focus** (indices 0..2 stay valid; zoom just recomputes).
- Focus is **ephemeral UI state**: not persisted (`persist.ts` untouched), not in undo history (`history.ts` untouched).
- Module-level `lastFocus: {cx,cy}` remembered in `main.ts` so re-entering without a hover lands on the previously focused cell (default `(0,0)`; border: if remembered cell is `(1,1)`— impossible by construction — fall back to `(0,0)`).

## 4. Enter/exit affordances (PM-1 brand language)

- **Focus key** in the toolbar: a new `tb-group` labeled `view` after the cell stepper, containing one 42px `.key.tool`-style cap with the 4px LED (dark at rest, orange glow + charcoal cap when focused — identical vocabulary to tool keys, but it is a *state* key, synced from `focus !== null`, not part of the tool radio group). New inline SVG icon in the existing style (stroke 1.6, currentColor): four corner brackets converging on a small square (a "zoom to cell" glyph). `title`: `focus one cell (z)`, `aria-pressed` reflects focus.
- **Hotkey `z`** toggles focus (free: tools use p/e/l/r/o/f/i, modes 1/2; Ctrl/Cmd+Z is guarded before the bare-key branch in the existing keydown handler). Target cell on enter: the **hovered** cell (`cx = floor(hover.x / C)`, etc.) if `hover != null`, else `lastFocus`. Clicking the toolbar key uses the same resolution (hover will normally be null → `lastFocus`).
- **Esc exits** focus (only when focused; otherwise ignore — don't swallow Esc globally).
- **Arrow keys move focus while focused** (`preventDefault` only when focused): clamp to 0..2, no wrap-around at edges; **border mode: stepping onto `(1,1)` continues one more step in the same direction** (so Left from `(2,1)` lands on `(0,1)`); if that would leave the grid, the move is a no-op. Tile mode: plain clamped moves (visually identical cells; the mini-map highlight moves).
- **Double-click to enter is deliberately not implemented**: `pointerdown` draws (and pushes an undo entry), so a double-click would plot and push twice before zooming. Record this decision, don't build compensation machinery.
- **Indicators while focused:** (a) the focus key LED is lit; (b) **LCD segment** — new field after `cell`: dim label `focus`, value `—` when null, orange `{cx+1}·{cy+1}` (1-based col·row, e.g. `1·3`) when focused; (c) **letterbox mini-map** (chrome, §6): a small 3×3 glyph in the bottom-right letterbox corner showing which cell is focused. (a)+(b) are required; (c) is drawn only when the letterbox is wide enough.
- **LCD tips** (brand voice): enter border → `one cell. all the pixels`; enter tile → `one tile. it still wraps`; exit → `back to nine`; rejected center → `center's locked. pick a live cell`.

## 5. Coordinate mapping & pointer rules while focused

All in `src/editor/grid-editor.ts`. Let `fx0 = focus ? focus.cx·C : 0`, `fy0` likewise; `Lf` as in §2.

**`toPt(e)` becomes offset-aware:**
```
devX = (e.clientX − rect.left) · dpr − ox        // rect = canvas.getBoundingClientRect()
raw  = floor(devX / z) + fx0                      // same for y with oy, fy0
```
Then clamp by state:
- **Unfocused:** clamp to `[0, L−1]` (today's behavior, now offset-corrected).
- **Focused, border:** clamp to `[fx0, fx0+C−1]` — the pointer cannot paint invisible pixels in neighboring cells.
- **Focused, tile:** **do not wrap, clamp only to `[fx0−C, fx0+2C−1]`** (one cell of margin). Raw coordinates beyond the cell edge feed Bresenham/shape rasters directly and `plotTile`'s `mod` maps every plotted pixel onto the tile — this *is* the "stroke crossing the edge wraps to the opposite side" semantics, identical to how the unfocused 3×3 view already works. (Never wrap the coordinates before rasterizing: wrapping the endpoints would make a short cross-edge line rasterize as a long backwards line.)

**Pointer-down gating:** a `pointerdown` whose position lies outside the art rect (`devX < 0 || devX ≥ Lf·z`, either axis, *before* clamping) is ignored for drawing and Alt-pick — no stroke starts from the letterbox, so clamping can't cause accidental edge painting. Once a stroke is live, `pointermove` uses the clamp rules above (so dragging out into the letterbox in focused tile mode keeps wrapping — required).

**Hover / LCD:** report hover from the same mapping; in focused tile mode display the wrapped position (`fx0 + mod(raw − fx0, C)`) so the LCD never shows out-of-range numbers, while tools receive raw values. Hover is `null` when the pointer is over the letterbox.

**Nothing else moves:** `ToolContext`, all seven tools, `plotView`/`floodView`/`getViewPx`, history push points, and preview regeneration (`dirtyDoc`/`dirtyPreview` flow) are untouched. Known and accepted: focused-border flood fill can escape the visible cell into neighbors (cell edges are not walls in border mode today) — that is "semantics preserved", and the live preview shows the result.

## 6. Rendering while focused

In `render()` (grid-editor):
- Compose `offNative` at full `L×L` exactly as today (border: putImageData of sheet; tile: 3×3 blit of the tile — cheap, ≤192²).
- Blit with a source rect: `ctx.clearRect(0,0,devW,devH); ctx.drawImage(checker, ox, oy); ctx.imageSmoothingEnabled = false; ctx.drawImage(offNative, fx0, fy0, Lf, Lf, ox, oy, Lf·z, Lf·z)`. Unfocused is the same call with `fx0=fy0=0, Lf=L`.
- Chrome under `ctx.save(); ctx.translate(ox, oy); … ctx.restore();` so `chrome.ts` keeps drawing from origin:
  - `drawDelineation` — **unfocused only** (thirds are meaningless inside one cell).
  - `drawCenterLock` — **unfocused border only** (center can never be focused).
  - **New `drawFocusMinimap(ctx, opts: { mode, cx, cy, devW, devH, ox, oy, artSize })`** in `src/editor/chrome.ts`, drawn *outside* the translate (it lives in the letterbox): a 3×3 grid of small squares (≈ 6 device px each, 1px `rgba(242,241,236,.35)` hairlines on the charcoal), focused cell filled `--orange` `#FF4E00`, border-mode center square dimmed/hollow. Anchor: bottom-right corner of the canvas, 8 device px inset, only if the letterbox on that side is ≥ 30 device px (`ox ≥ 30` or `oy ≥ 30`; pick the roomier side, else skip entirely). Skipping is fine — LED + LCD carry the state.

Relayout trigger: extend the existing store subscription in grid-editor to `s.focus !== prev.focus → needLayout = true; requestRender()` (alongside the current `dirtyDoc`/`mode`/`cellSize` conditions — mode switch also clears focus, which this catches).

## 7. Exact changes per file

| File | Change |
|---|---|
| `src/styles/app.css` | `.bezel`: `min-height: 560px` → `height: 560px`; media block `min-height: 320px` → `height: 320px`. No other layout rules change (canvas element is sized inline by `layout()` as today, now to the full inner box). |
| `src/state/store.ts` | Add `focus: { cx: number; cy: number } \| null` to `AppState` + doc comment (ephemeral, never persisted). |
| `src/editor/grid-editor.ts` | Rework `layout()` (full-bezel canvas, `Lf`, `z`, `ox/oy`, checker at `Lf·z`); rework `render()` (clear full canvas, source-rect blit, translated chrome, mini-map); rework `toPt()` + pointerdown gating + hover rules per §5; extend invalidation subscription with `focus`. Keep RO + DPR watch untouched. |
| `src/editor/chrome.ts` | `drawChecker`/`drawDelineation`/`drawCenterLock` unchanged (grid-editor translates). Add `drawFocusMinimap(...)` per §6. |
| `src/main.ts` | Initial state gets `focus: null`. New actions: `enterFocus(cx,cy)` (validates border-center, sets tip, records `lastFocus`), `exitFocus()`, `toggleFocus()` (hover→cell else `lastFocus`), `moveFocus(dx,dy)` (border center-skip per §4). `setMode()` also sets `focus: null`. Keyboard handler: bare `z` → `toggleFocus()`; `Escape` when focused → `exitFocus()`; Arrow keys when focused → `moveFocus` + `preventDefault`. Pass `onFocus` handler to toolbar; pass `focus` through `syncAll` to toolbar + lcd. |
| `src/ui/toolbar.ts` | Add `view` tb-group after the cell group: one focus key (`.key.tool` styling + `.led`), new corner-brackets SVG icon (stroke 1.6, currentColor), `onFocus()` handler in `ToolbarSpec.handlers`, `focus: boolean` in `sync()` state → `aria-pressed`. |
| `src/ui/lcd.ts` | `LcdState` gains `focus: { cx: number; cy: number } \| null`; new segment `focus` (dim label, `—` or orange `b`-element `{cx+1}·{cy+1}`); wire in `sync()`. |
| *(no changes)* | `src/state/doc.ts`, `history.ts`, `persist.ts`, `src/tools/*`, `src/raster/*`, `src/preview/*`, `src/export/*`. If any of these needs edits during implementation, stop and re-check the design — the seams above are supposed to make them invariant. |

## 8. Acceptance criteria (verify by hand in `npm run dev`; `npm run typecheck` clean)

1. **Fixed footprint:** stepping cell size 8 → 64 (and every stop between) leaves the bezel's and canvas element's bounding boxes unchanged (verify with devtools box model); only the drawn art resolution changes, centered, letterboxed on charcoal.
2. **Crispness:** at every cell size and while focused, pixels render with no blur/bleed (integer device zoom) on both a 1× and a HiDPI display; dragging the window between monitors with different DPR relayouts and stays crisp; resizing the window relayouts.
3. **Letterboxing:** when inner-box ÷ resolution is non-integer, the art uses the largest integer device zoom that fits and is centered; clicks/drags starting in the letterbox draw nothing and clear the hover readout.
4. `z` (and the toolbar focus key) enters focus on the hovered cell; with no hover it re-enters the last focused cell (first time: top-left). The focus key LED lights, the cap goes charcoal/orange, and the LCD shows the orange `focus {c}·{r}` value.
5. **Esc exits focus**; `z` toggles it off too; the LED/LCD revert; exiting restores the 3×3 view with thirds delineation (and the center hatch in border mode).
6. **Border mode: the center cell cannot be focused** — pressing `z` while hovering the center refuses with the tip `center's locked. pick a live cell`; arrow-key navigation skips over the center; no code path renders a focused center.
7. **Focused tile mode wraps:** a pencil drag or a line-tool drag that crosses the focused cell's edge continues from the opposite edge (torus), matching what the same gesture does unfocused; flood fill still wraps; both previews (and the border previews when applicable) keep updating live while focused.
8. **Focused border mode is bounded:** strokes clamp at the focused cell's edges — no pixels appear in neighboring cells from pencil/line/rect/ellipse (flood may still cross, as it does unfocused).
9. **All tools identical while focused:** all seven tools + Alt-click pick work with correct results in both modes; shape previews (line/rect/ellipse restore-and-redraw) render correctly at focus zoom.
10. **Undo/redo identical while focused:** draw focused → Ctrl/Cmd+Z undoes exactly that stroke; redo restores it; undoing a cell-size change while focused keeps a valid focused view; per-mode stacks unaffected.
11. **Mode switch (`1`/`2`) exits focus**; cell-size stepping while focused keeps the same cell focused at the recomputed zoom.
12. **Brand audit:** focus key matches tool-key vocabulary (LED, charcoal active cap, orange icon), LCD segment uses dim label + orange value, mini-map (when the letterbox fits it) is hairline + single orange accent, all copy lowercase deadpan, `prefers-reduced-motion` and focus-visible behavior unchanged.

## 9. Implementation order (app runnable after every step)

1. **Fixed footprint (req 1 complete, no focus yet):** CSS bezel height; rewrite `layout()`/`render()`/`toPt()` with `Lf = L`, `ox/oy`, letterbox gating, translated chrome. Verify criteria 1–3. Commit.
2. **Focus state + plumbing:** `AppState.focus`, main.ts actions + keyboard (`z`/Esc/arrows), mode-switch clears focus, toolbar focus key, LCD segment; grid-editor consumes `focus` (Lf = C, `fx0/fy0` mapping, border clamp, chrome suppression, relayout-on-focus). Verify criteria 4–6, 8–11 in border mode. Commit.
3. **Tile wrap + mini-map + polish:** focused-tile clamp margin + hover wrap display, `drawFocusMinimap`, tips, brand pass. Verify criteria 7 and 12; full re-run of the list. Commit.

## 10. Risks / notes for the implementer

- **The `toPt` rewrite is the highest-risk edit** — every gesture flows through it. Keep the device-space math in one place and derive `fx0/Lf/clamp` from a single helper that both `toPt` and `layout` agree on, or the art rect and the pointer map will drift.
- **Do not wrap coordinates before rasterizing in focused tile mode** (§5) — wrap must happen per-plotted-pixel inside `plotTile`, as it already does. Wrapping endpoints breaks cross-edge lines.
- **`getBoundingClientRect` during `layout()`** is called on the *container* (bezel); `toPt` uses the *canvas* rect. After this change the canvas fills the bezel, but keep using the canvas rect in `toPt` — it's the thing the offsets are relative to.
- **Checker cache size** now follows `Lf·z`, which changes on focus enter/exit — make sure `layout()` (not `render()`) owns resizing + redrawing it, as today.
- The mini-map is decorative state display: if it fights the layout at any bezel size, drop it (criteria only require LED + LCD).
- Keep `doc.ts`/`raster/*` DOM-free and untouched — the Tauri seam from PM-3 still applies.

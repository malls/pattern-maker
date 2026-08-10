# PM-9: Border preview 2× box + upscaled 2×/4× nearest-neighbor export

Read `BRANDING.md` before touching UI. Every new control is a key cap, every new
label is 9px lowercase mono, and orange appears only where something is live.

## 0. Fixed decisions (from the task comment — do not relitigate)

1. **Border preview gains a fifth sample box**: the same sheet drawn pixel-doubled —
   `border-width: 2·C`, `border-image` slice stays `C`, repeat mode `repeat`,
   label `repeat 2×`. Tile mode's preview (the `repeat 4×` / `repeat 1×` swatches)
   is **not** touched.
2. **PNG export gains an upscale factor** 1×/2×/4×, nearest-neighbor. Exposed as a
   small discrete stepper beside the export key in the transport row, in the same
   vocabulary as the cell-size stepper. The LCD shows the resulting output pixel
   size. One export key; the current scale applies.

Throughout: `C` = `doc.cellSize` (1–64), `S` = export scale ∈ {1, 2, 4}.
Border sheets are `3C × 3C`; tiles are `C × C`.

## 1. Decisions on the open questions

### 1.1 The copied CSS snippet DOES reflect the export scale

The snippet must be correct for the image the user just produced, so the `css` key
and the `export` key are governed by the same `S`: the snippet's data URI is
generated from the **same nearest-neighbor-upscaled buffer** the PNG export would
write, and the numbers scale with it.

The rule is *the S=1 numbers multiplied by S*. Define `unit = C · S`:

| mode | at S | data URI raster | snippet |
|---|---|---|---|
| border | S | `3·unit × 3·unit` | `border: {unit}px solid transparent; border-image: url(…) {unit} round;` |
| tile | S | `unit × unit` | `background-size: {unit·4}px {unit·4}px;` (comment: `{unit}px is 1:1`) |

Why this and not the alternative ("same rendered size, more pixels" — slice `C·S`
with `border-width: C`): the stated purpose of the feature is *"the pixel look
survives when used for larger UI elements"*. Larger UI element ⇒ the border is
drawn bigger ⇒ each art pixel covers more screen pixels, and the upscaled raster
is what keeps that crisp without depending on `image-rendering: pixelated`. The
retina reading (same size, denser asset) would make the pixels *smaller*, which is
the opposite of the request.

Consequences to honour:

- `border-image-slice` is unitless ⇒ image pixels ⇒ it must be `C·S`, because the
  thirds of a `3C·S` sheet are at `C·S`. Getting this wrong is the one way to ship a
  snippet that renders garbage.
- At `S = 1`, `unit === C`, so **the border snippet is byte-identical to today's**
  and the tile snippet differs only in the trailing comment. No regression.
- The tile snippet keeps its deliberate 4× readability zoom (`4·unit`) and its
  escape hatch, now stated as an exact number rather than "drop for 1:1".
- Cost, accepted knowingly: a 4× copy at `C = 64` embeds a 768×768 PNG as base64
  (order 10²  KB). For CSS *specifically* an upscaled raster buys little over
  `pixelated` on a 1× URI — but correspondence between "the file I exported" and
  "the CSS I pasted" is the property this tool sells, and `pixelated` is not
  universally honoured on every rendering path. The LCD `out` segment is the
  user's warning signal that they asked for something big.

### 1.2 The live previews stay 1× — always

`refreshPreviews()` keeps generating its data URI from `activeBuffer(doc, mode)`
with **no scale applied**, and `borderPreview.update(uri, cellSize)` /
`tilePreview.update(uri, cellSize)` keep their current signatures.

Why: the previews are live CSS against a 1× URI, not exports. An N× raster with
N×-scaled slice/`border-width` renders *pixel-identically* to the 1× raster with
1× slice — so scaling the preview would be a visual no-op that costs a 16×-larger
`toDataURL` on the debounced draw path. Nothing in `preview/` may read
`state.exportScale`; that is the "nothing double-scales" invariant.

The new `repeat 2×` box is likewise **not** an export-scale preview. It doubles
the *CSS drawing size* (`border-width: 2C` against slice `C`), not the raster
resolution, and it does so unconditionally at every scale. The two features look
related and are not; keep them independent in the code and the reviewer will
never confuse them.

### 1.3 Fifth box layout

`.bp-grid` keeps `repeat(2, 1fr)` for the four variant boxes at their existing
158px; the new box is appended as a **full-width fifth row item**
(`grid-column: 1 / -1`), centered, with a JS-computed square size.

- Rejected: 3-up wrapping. Three columns in the 440px output column give ~139px
  per column, shrinking the four variant boxes. 158px is load-bearing — it is
  deliberately not a multiple of any slice so `repeat`/`round`/`space` visibly
  differ (see the header comment in `border-preview.ts`). Shrinking them to fit a
  box that *isn't a fifth variant* is the wrong trade.
- Composition also argues for it: this is not a fifth repeat mode, it is the same
  `repeat` mode rendered as a study. A 2×2 block plus one wide study reads
  correctly; a 3+2 ragged grid claims a peer relationship that isn't there.

**The box cannot be a fixed 158px.** With the global `* { box-sizing: border-box }`,
a declared 158px width and `border-width: 2·64 = 128px` per side (total 256px)
floors the content box at 0 and the *used* border-box width becomes 256px — the
element silently grows and breaks out of the grid. So:

```ts
const BOX_PX = 158;           // keep in sync with .bp-box in app.css
const bw = cellSize * 2;      // border-width
const size = Math.max(BOX_PX, bw * 2 + 64);   // == max(158, 4·C + 64)
```

| C | border-width | box size |
|---|---|---|
| 1–23 | 2–46 | 158 |
| 24 | 48 | 160 |
| 32 | 64 | 192 |
| 48 | 96 | 256 |
| 64 | 128 | 320 |

320px max fits the ~428px full-width grid row with room to spare, so no overflow.
The `+ 64` guarantees at least a 64px content strip so the box always reads as a
frame with a middle, never as four corners jammed together. At `C = 16` (default)
the box stays exactly 158 and matches its neighbours; the growth only begins where
the geometry actually demands it.

Distinctness at 158/`C = 16`: edge run is `158 − 2·32 = 94px` against a `2·32 = 64px`
edge tile ⇒ 1.47 tiles ⇒ `repeat`'s characteristic clipped tile is plainly visible.
Accepted limitation: the output column grows taller at large cell sizes (up to
~690px of preview stack at `C = 64`), pushing the device height past the bezel's
clamp. That is honest — you asked to see a 64px cell drawn at double size.

### 1.4 Scale stepper specifics

- **Values**: exactly `{1, 2, 4}` from a frozen `EXPORT_SCALES` tuple. The `−`/`+`
  keys move an index, clamped, no wrap. Not free integers, not shift-modified —
  three values do not need a fast path.
- **Store field**: `AppState.exportScale: 1 | 2 | 4`, default `1`. Union-typed so
  illegal states are unrepresentable; with `noUncheckedIndexedAccess`,
  `EXPORT_SCALES[i] ?? 1` narrows correctly.
- **Session-only. Never persisted** — not in `pattern.json`, not in the
  localStorage autosave, not in undo history. Justification: it describes how you
  want to emit an asset right now, not what the document *is* — exactly the
  category `focus` and the selection already occupy ("ephemeral UI state — never
  persisted"). Persisting it would also mean a project mailed to someone else
  silently emits 4× files, and would force either a `ProjectV1` schema bump or a
  lenient decode in a decoder whose whole design is strictness. Resets to 1× on
  every boot and is untouched by load/undo/mode/cell changes.
- **No hotkey.** `1` and `2` are already mode switches, and they are precisely the
  digits a user would reach for to mean 1×/2× — binding them would be an ambiguity
  trap. Scale is a low-frequency pre-export control; the two keys are in the normal
  tab order and operate on Enter/Space, which is the accessibility floor required.
- **Readout is a display, not an editor**: a `<span class="readout">` reading `1×`
  / `2×` / `4×`, `aria-live="polite"`, non-interactive. The cell readout's
  click-to-type exists because 64 values is too many for two keys; three values is
  not. An inert charcoal readout is the standard instrument idiom.
- **Readout colour stays `--lcd-text`** at every scale, like the cell readout. The
  live-state signal belongs to the LCD (below), and orange on a control that is
  simply showing its value would be decoration.

### 1.5 LCD `out` segment

New segment between `cell` and `focus`: `out 048×048`, each axis zero-padded to
three digits (matching `x`/`y`/`cell`).

```
size = (mode === "border" ? 3 : 1) · C · S
```

| mode | C | S | reads |
|---|---|---|---|
| tile | 1 | 1 | `out 001×001` |
| border | 16 | 1 | `out 048×048` |
| tile | 16 | 4 | `out 064×064` |
| border | 16 | 4 | `out 192×192` |
| border | 64 | 4 | `out 768×768` |

Both extremes are three digits, so the readout never jitters — 768 is the maximum
and `001` the minimum. Border and tile deliberately report different numbers
because they export different things; the `mode` segment sits two fields to the
left and explains it.

**Colour**: plain `--lcd-text` at `S = 1`, orange when `S > 1` — orange marks the
departure from the default, exactly as `focus` and `sel` do. Implement with the
existing two-element idiom in `lcd.ts` (a plain `<span>` and an orange `<b>`, one
of them `display: none`).

### 1.6 Nearest-neighbor mechanics

**Per-pixel expansion in `PixelBuffer` space**, reusing the existing
`resizeNearest` — not `drawImage` with `imageSmoothingEnabled = false`.

Justification: `resizeNearest(b, b.w·S, b.h·S)` computes
`sx = floor(x·b.w / (b.w·S)) = floor(x / S)`, which is exact integer pixel
replication with no rounding to argue about. It is DOM-free, deterministic, and
independent of any engine's smoothing/quality heuristics (`imageSmoothingEnabled`
has historically not been honoured uniformly across paths, and a canvas-scaled
draw can still produce seam artifacts). Cost is O(output) — 590k pixels worst case
(768²), on the export/copy path only, never on the debounced preview path.

Add one thin wrapper next to `resizeNearest` in `raster/buffer.ts`:

```ts
/** Integer nearest-neighbor upscale (1 returns the same buffer — no copy). */
export function scaleUp(b: PixelBuffer, factor: number): PixelBuffer {
  return factor <= 1 ? b : resizeNearest(b, b.w * factor, b.h * factor);
}
```

The `factor === 1` identity path means the S=1 export path is byte-identical to
today's. Callers only read the result, so returning `b` itself is safe.

**Reuse the existing PNG path**: `bufferToCanvas` → `toDataURL` in
`preview/compose.ts` stays the single rasteriser. `downloadPNG` gains a `scale`
parameter and pipes the buffer through `scaleUp` first. No second export path.

### 1.7 Filename stays `pattern.png` at every scale

Not `pattern@2x.png`. BRANDING.md §7 is explicit, and `@2x` conventionally means
*same size, double density* — the opposite of what this scale does. The LCD tip
confirms what was written.

## 2. Per-file changes

No new files.

### `src/raster/buffer.ts`
Add `scaleUp(b, factor)` as specified in §1.6, directly below `resizeNearest`.

### `src/preview/border-preview.ts`
- Add `const BOX_PX = 158;` with a "keep in sync with `.bp-box`" comment.
- After the four-variant loop, build the fifth item:
  `h("div", { className: "bp-item bp-item-wide" }, twoBox, h("span", { text: "repeat 2×" }))`
  where `twoBox` is `h("div", { className: "bp-box" })`.
- In `update(uri, cellSize)`, after the variant loop:
  ```ts
  const bw = cellSize * 2;
  const size = Math.max(BOX_PX, bw * 2 + 64);
  twoBox.style.width = `${size}px`;
  twoBox.style.height = `${size}px`;
  twoBox.style.border = `${bw}px solid transparent`;
  twoBox.style.borderImage = `url("${uri}") ${cellSize} repeat`;
  ```
  Comment the asymmetry: `border-width` is doubled while the slice stays `cellSize`
  because the slice is measured in *image* pixels — the browser scales the slice
  up, and `.bp-box`'s `image-rendering: pixelated` keeps that crisp.
- Signature unchanged. No knowledge of export scale.

### `src/preview/tile-preview.ts`
No change. (Stated so the reviewer knows it was considered.)

### `src/styles/app.css`
```css
.bp-grid { ...existing...; min-width: 0; }         /* defensive: never force overflow */
.bp-item-wide { grid-column: 1 / -1; }             /* the repeat 2× study spans the row */
```
Add a `/* the 2× box overrides width/height inline — see border-preview.ts */`
note on `.bp-box`.

Transport stepper (new rules, after the `.t-key` block):
```css
.transport { ...existing...; align-items: end; }   /* no-op today; keeps the stepper's label baseline */
.t-group { display: grid; justify-items: center; gap: 3px; }
.t-group > span {                                   /* same label treatment as .t-key span */
  font: 9px var(--font-mono); letter-spacing: .09em; color: var(--label);
}
.t-scale .key { width: 26px; height: 34px; }        /* cap height matches .t-key .cap */
.t-scale .readout { width: 34px; padding: 10px 6px; }
```
The group reuses `.stepper` for its layout and `.readout` for its charcoal display,
so the vocabulary is literally the cell stepper's. Group width ≈ 98px; the deck has
room (transport grows 412 → 518px inside a ≥1400px device, and `.deck` wraps).

### `src/ui/transport.ts`
- Change the factory to the spec-object shape used by `createToolbar`:
  ```ts
  export interface TransportSpec {
    onAction(id: TransportAction): void;
    /** Step the export scale by ±1 position through {1,2,4}. */
    onScaleStep(delta: number): void;
  }
  export interface TransportView { root: HTMLElement; sync(s: { exportScale: number }): void; }
  ```
- While iterating `KEYS`, append the scale group immediately **before** the
  `export` button, so the row reads `… save load css [− 1× +] export`.
- Group markup: `.t-group` > (`.stepper.t-scale` > `−` key, `.readout` span, `+`
  key) + `<span>scale</span>`. Key titles `smaller export` / `larger export`,
  `aria-label`s to match; readout gets `aria-live="polite"` and
  `aria-label="export scale"`.
- `sync` sets `readout.textContent = `${s.exportScale}×``.

### `src/ui/lcd.ts`
- `LcdState` gains `out: { size: number; scaled: boolean }`.
- Build `outOffEl = h("span")` / `outOnEl = h("b")` (the latter `display: none`),
  insert the segment `h("span", {}, h("span", { className: "dim", text: "out" }), " ", outOffEl, outOnEl)`
  between the `cell` and `focus` segments.
- In `sync`: `const t = `${pad3(s.out.size)}×${pad3(s.out.size)}``, write it into
  whichever element is shown, toggling on `s.out.scaled`.

### `src/export/png.ts`
```ts
export function downloadPNG(b: PixelBuffer, scale = 1): void {
  ...
  a.href = bufferToDataURI(scaleUp(b, scale));
}
```
Update the header comment to mention the integer upscale.

### `src/export/css.ts`
- Rename the second parameter of both functions from `cellSize` to `unit`, with a
  doc comment: *"cell size × export scale — the slice/tile size in the emitted
  image's own pixels."* No other signature change; the callers pass the product.
- `tileCSS` comment becomes:
  `/* 4× zoom so the pixels read; ${unit}px is 1:1 */`.
- `borderCSS` output is otherwise unchanged.

### `src/state/store.ts`
Add to `AppState`, with the ephemerality documented next to `focus`'s note:
```ts
/** PNG/CSS output upscale ∈ {1,2,4}. Session-only UI state — never
 *  persisted, never in undo history, never applied to the live previews. */
exportScale: 1 | 2 | 4;
```

### `src/main.ts`
- `const EXPORT_SCALES = [1, 2, 4] as const;`
- Store init: `exportScale: 1` (always — ignore `restored`).
- `import { scaleUp } from "./raster/buffer";`
- New action, mirroring `stepCell`'s voice:
  ```ts
  function stepScale(delta: number): void {
    const s = store.get();
    const i = EXPORT_SCALES.indexOf(s.exportScale);
    const j = Math.min(EXPORT_SCALES.length - 1, Math.max(0, i + delta));
    const next = EXPORT_SCALES[j] ?? 1;
    if (next === s.exportScale) {
      store.set({ tip: delta > 0 ? "that's as big as exports get" : "that's as small as exports get" });
      return;
    }
    store.set({ exportScale: next, tip: `scale ${next}×` });
  }
  ```
  Note: plain `store.set` — it must **not** bump `dirtyDoc`/`dirtyPreview`, so it
  triggers neither a preview regeneration nor an autosave. That is the mechanism
  behind the "previews unchanged at 2×" criterion; do not route it through `bumpDoc`.
- `function outputSize(s: AppState): number { return (s.mode === "border" ? 3 : 1) * doc.cellSize * s.exportScale; }`
- `doCopyCss`:
  ```ts
  const scale = s.exportScale;
  const unit = doc.cellSize * scale;
  const uri = bufferToDataURI(scaleUp(activeBuffer(doc, s.mode), scale));
  const snippet = s.mode === "border" ? borderCSS(uri, unit) : tileCSS(uri, unit);
  ... tip: ok ? (scale === 1 ? "css copied" : `css copied ${scale}×`) : "couldn't reach the clipboard"
  ```
- `doExportPng`: `downloadPNG(activeBuffer(doc, s.mode), s.exportScale)`, tip
  `"pattern.png"` at 1× and `` `pattern.png ${scale}×` `` above.
- `createTransport({ onAction: onTransport, onScaleStep: stepScale })`.
- `syncAll`: add `transport.sync({ exportScale: s.exportScale })` and
  `out: { size: outputSize(s), scaled: s.exportScale > 1 }` to the `lcd.sync` call.

### Not changed (deliberately)
`state/persist.ts` (no schema change), `state/history.ts`, `state/doc.ts`,
`editor/`, `preview/compose.ts`, `preview/tile-preview.ts`.

## 3. Implementation order

Each step leaves the app runnable and typechecking.

1. `raster/buffer.ts`: `scaleUp`. Pure addition, no behaviour change.
2. `border-preview.ts` + `app.css` grid rules: the fifth box. Feature 1 complete
   and verifiable on its own, entirely independent of everything below.
3. `store.ts` `exportScale` + `lcd.ts` `out` segment + `main.ts` `outputSize` and
   the `lcd.sync` wiring. The LCD now reports output size; scale is pinned at 1×.
4. `transport.ts` stepper + `app.css` transport rules + `main.ts` `stepScale` and
   `transport.sync`. The control now moves and the LCD tracks it; output is still
   unaffected — verify the previews do not flicker or regenerate on a step.
5. `export/png.ts` scale parameter + `doExportPng`. Upscaled PNG export works.
6. `export/css.ts` `unit` rename/comment + `doCopyCss`. Snippet matches the export.
7. `npm run build` (tsc strict, zero errors), then the manual pass in §4, then commit.

## 4. Acceptance criteria

Verify by hand in `npm run dev`, Chrome plus one of Firefox/Safari.

1. `npm run build` passes with zero TypeScript errors under the strict config.
2. Border mode shows **five** boxes: the four 158px variants in two columns
   exactly as before, plus a full-width fifth labelled `repeat 2×` in 9px
   lowercase mono.
3. At `C = 16` the fifth box computes to 158×158 with `border-width: 32px` and
   `border-image: url(…) 16 repeat`; its border art is visibly **twice** the size
   of the `repeat` box's art, with hard pixel edges and no blur or interpolation at
   100% browser zoom, in both tested engines.
4. At `C = 64` the fifth box's *computed* width and height are exactly `320px`
   (dev tools), it does not overflow the output column, and no element in
   `.bp-grid` exceeds its declared width.
5. Tile mode's preview is byte-for-byte unchanged: two swatches, `repeat 4×` and
   `repeat 1×`.
6. The transport row reads `undo redo clear save load css [− 1× +] export` with a
   `scale` label under the stepper, key caps that depress, and orange
   focus-visible rings. Stepping goes 1→2→4 and clamps: at 4× the `+` key yields
   the tip `that's as big as exports get`; at 1× the `−` key yields
   `that's as small as exports get`. Moving to 2× yields `scale 2×`.
7. The LCD `out` segment reads: border/`C=16`/1× → `out 048×048` in plain
   lcd-text; border/`C=16`/4× → `out 192×192` in orange; tile/`C=16`/4× →
   `out 064×064`; border/`C=64`/4× → `out 768×768`; tile/`C=1`/1× → `out 001×001`.
8. Export dimensions: at 4× with `C = 16`, tile mode writes a **64×64** PNG and
   border mode a **192×192** PNG. At 4× with `C = 48`, tile writes **192×192** and
   border **576×576**. At 1× both modes write exactly what they write today
   (`C×C` and `3C×3C`).
9. The upscale is exactly nearest-neighbor: draw a single isolated pixel, export
   at 4×, and confirm it is a hard-edged 4×4 block of one identical RGBA value with
   no anti-aliased fringe on any side.
10. At `S = 1` the border CSS snippet is byte-identical to the pre-change output,
    and the tile snippet differs only in its trailing comment.
11. Paste a 2× border snippet (`C = 16` ⇒ `border-width: 32px`,
    `border-image: url(…) 32 repeat`) onto a 158×158 div in a scratch HTML page:
    it renders identically to the `repeat 2×` preview box.
12. Previews are unchanged when scale is 2× or 4×: all five border boxes and both
    tile swatches are pixel-identical to their 1× state, and stepping the scale
    triggers no preview regeneration (confirm no flicker; if in doubt, temporarily
    instrument `refreshPreviews`).
13. Scale is session-only: set 4×, reload — it is 1× again; save `pattern.json` at
    4× and confirm the JSON contains no scale field and loading it leaves the scale
    where it was.
14. Scale survives untouched across undo/redo, mode switches, cell-size changes,
    focus, and project load — none of them alter it, and it alters none of them.
15. Brand audit: `scale` label 9px lowercase mono in `--label`; readout charcoal
    with `--lcd-text` tabular figures at every scale; no colour outside the token
    set; the only new orange is the LCD `out` value when `S > 1` and the standard
    focus rings; key travel and `prefers-reduced-motion` unaffected.

## 5. Risks / notes for the implementer

- **`image-rendering: pixelated` on `border-image`** is what keeps the 2× box
  crisp (`border-width` 2× against a 1× slice means the browser *is* upscaling).
  `.bp-box` already sets it, and engines honour it for border-image today — but
  verify visually in both tested engines. If an engine ever blurs it, the fallback
  is not to cap the border-width (that would break the exact 2× relationship) but
  to feed that box a 2×-upscaled URI via `scaleUp` with slice `2C`; note it and
  raise it rather than improvising.
- **`box-sizing: border-box` + fat borders** silently inflates the used width past
  the declared one. The §1.3 size formula is the only thing preventing that; if
  the formula is edited, re-check `C = 64`.
- **Output column height** grows to ~690px at `C = 64`, exceeding the bezel clamp
  and making the device taller. Accepted.
- **4× copy payload**: a 768×768 base64 PNG inside a CSS snippet is large. Intended
  and user-driven; the `out` segment is the signal.
- **Do not route `stepScale` through `bumpDoc`.** Bumping `dirtyPreview` would
  regenerate previews and churn the autosave for a control that changes neither
  the document nor the previews.
- **The slice must scale with the raster.** `border-image-slice` unitless = image
  pixels. A 2× sheet with slice `C` renders wrong in a way that looks *almost*
  right at a glance — check criterion 11 carefully rather than eyeballing it.

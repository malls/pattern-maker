# PM-3: Scaffold pattern making software — Implementation Plan

This plan is self-contained. Read BRANDING.md and demo/pattern-maker-demo.html before starting; they define the visual identity (PM–1 "device" language) and a working reference for the control vocabulary. The app is a real Vite project, not a single file — the demo informs the stylesheet and interaction feel, not the architecture.

## 0. Fixed decisions (do not relitigate)

- Web app; Vite + vanilla TypeScript; no framework; no runtime dependencies (dev deps only). Architect so a Tauri wrap is possible later (no Node/browser-only globals in core logic; all platform I/O behind small modules) — but no desktop work now.
- Zoomed pixel editor: low-res cells (configurable 8–64 px per cell), crisp nearest-neighbor scaling, pencil paints single pixels.
- Two modes: **border** (3×3 sheet, center cell locked/empty, output = CSS border-image) and **tile** (single cell-sized tile shown 9×, torus wrap drawing, output = CSS background-image).
- Day-one outputs: PNG export, copyable CSS snippet (data-URI image), project save/load (localStorage autosave + JSON file download/import).
- Layout per spec: toolbar **above** the main UI, grid editor **left**, rendered output **right**. (Note: the demo uses a left rail — the spec overrides; keep the key-cap vocabulary, change the geometry.)
- Visual identity MUST follow BRANDING.md exactly (tokens, type, control system, voice).

## 1. Scope

**Delivers:** a running app where both modes are fully usable at MVP level — draw with the full toolset, undo/redo, live previews, all three export paths, autosave/restore, JSON round-trip — styled entirely in the PM–1 brand language.

**Explicitly deferred (do not build):**
- Symmetry drawing (the brand's signature feature — a later task; leave room in the toolbar design but do not implement).
- Brush/spray (anti-aliased tools don't fit a pixel editor; the demo's versions do not carry over).
- Zoom/pan of the editor, selection/move tools, layers, palette editing beyond the 16 brand chips + custom color well, touch gestures beyond basic pointer events, Tauri packaging, tests beyond `tsc --noEmit` (a test harness is a follow-up task).

## 2. Repo / tooling setup

The repo already has git initialized (one commit, `demo 1`) — **do not `git init`**; there is no package.json yet.

1. Add `.gitignore`: `node_modules/`, `dist/`, `.DS_Store`.
2. Scaffold by hand (running `npm create vite` in a non-empty dir is awkward): write `package.json`, `tsconfig.json`, `index.html`, `src/`. No `vite.config.ts` needed (defaults are fine; add one only if something forces it).
3. `package.json`: `"private": true`, `"type": "module"`; devDependencies: `vite`, `typescript` (current stable); scripts:
   - `dev`: `vite`
   - `build`: `tsc --noEmit && vite build`
   - `preview`: `vite preview`
   - `typecheck`: `tsc --noEmit`
4. `tsconfig.json`: `"strict": true`, `"noUncheckedIndexedAccess": true`, `"noImplicitOverride": true`, `"exactOptionalPropertyTypes": true`, `"target": "ES2022"`, `"module": "ESNext"`, `"moduleResolution": "bundler"`, `"lib": ["ES2022", "DOM", "DOM.Iterable"]`, `"noEmit": true`.
5. Commit the scaffold before feature work; commit per phase thereafter.

## 3. Project structure

```
index.html                 shell: mounts #app, loads /src/main.ts, sets <title>pattern maker PM–1</title>
src/
  main.ts                  boot: build DOM from ui/ modules, create store, load autosave, wire everything
  state/
    store.ts               minimal observable store (get/set/subscribe) — the only communication mechanism
    doc.ts                 document model: per-mode pixel buffers, mode semantics (center lock, torus)
    history.ts             undo/redo snapshot stacks
    persist.ts             localStorage autosave, JSON project encode/decode, file download/import
  raster/
    buffer.ts              PixelBuffer type (Uint32Array RGBA + w/h), get/set/fillAll, clone, base64 codec
    raster.ts              pure algorithms over a plot(x,y) callback: Bresenham line, rect outline, midpoint ellipse, scanline flood fill
  tools/
    types.ts               Tool interface: { id, hotkey, cursor, onDown(pt,tctx), onMove, onUp } where tctx exposes plot/commit/preview/pick
    pencil.ts eraser.ts line.ts rect.ts ellipse.ts fill.ts eyedropper.ts
    index.ts               tool registry + hotkey map
  editor/
    grid-editor.ts         the left canvas: zoom math, DPR handling, pointer→pixel mapping, render loop, shape-preview overlay
    chrome.ts              grid-line / cell-delineation / center-lock-hatch / checkerboard drawing
  preview/
    compose.ts             PixelBuffer → offscreen canvas → PNG data URI (shared by previews and exports); debounce helper
    border-preview.ts      right panel, border mode: 4 sample boxes (stretch/repeat/round/space) with real border-image applied
    tile-preview.ts        right panel, tile mode: swatch with real background-repeat at 1× and 4× scale
  export/
    png.ts                 download pattern.png (border: full sheet; tile: single tile)
    css.ts                 CSS snippet generation for both modes + navigator.clipboard copy
  ui/
    dom.ts                 tiny h()/el() helper for building elements (no innerHTML for dynamic content)
    toolbar.ts             top rail: tool keys with LEDs + mode toggle bank + cell-size stepper
    chips.ts               16 brand chips + custom color well + current-color chip
    transport.ts           undo / redo / clear / save / load / copy css / export keys
    lcd.ts                 charcoal status strip: tool, x/y (zero-padded 3-digit), mode, cell, tips, blinking cursor
  styles/
    tokens.css             brand tokens copied verbatim from the demo's :root block
    app.css                device shell, masthead, key caps, bezel, deck, lcd, layout grid
```

**Module communication — the store pattern.** One `createStore<T>(initial)` in `state/store.ts`:

```ts
interface Store<T> {
  get(): T;
  set(patch: Partial<T>): void;          // shallow merge + notify
  subscribe(fn: (s: T, prev: T) => void): () => void;
}
```

App state (UI-ish, in the store): `{ mode, tool, color, cellSize, hover: {x,y} | null, dirtyDoc: number, dirtyPreview: number }`. The pixel buffers themselves live in `doc.ts` (mutable typed arrays — do NOT copy them through the store); mutations bump `dirtyDoc` via `store.set`, which is what subscribers key off. `grid-editor` re-renders on rAF when `dirtyDoc` changed; previews regenerate on a debounced `dirtyDoc` (see §6). UI modules subscribe to reflect state (LED on active tool key, etc.) and call plain exported actions (`setTool`, `setMode`, `applyStroke`) — no event-bus indirection beyond this.

## 4. Data model

**PixelBuffer** (`raster/buffer.ts`): `{ w: number; h: number; data: Uint32Array }`, one u32 per pixel, packed **ABGR** (little-endian layout matching `Uint32Array` view over `ImageData.data`), `0x00000000` = transparent. Helpers: `get(b,x,y)`, `set(b,x,y,rgba)`, `clone(b)`, `clear(b)`, `resizeNearest(b, w, h)`, `toBase64(b)` / `fromBase64(s,w,h)` (raw bytes → base64, no PNG involved).

**Document** (`state/doc.ts`) — one project holds *both* mode documents so switching modes never loses work:

- `cellSize: number` — 8..64, shared by both modes (stepper values: 8, 12, 16, 24, 32, 48, 64).
- `border: PixelBuffer` of size `(3·cellSize) × (3·cellSize)` — the full 3×3 sheet. The center cell region `[cellSize, 2·cellSize)²` is **locked**: `doc.plotBorder(x,y,c)` silently rejects writes inside it, and flood fill treats it as a wall. It stays transparent forever.
- `tile: PixelBuffer` of size `cellSize × cellSize` — the single tile. The editor *view* is 3×3 tiles (`3·cellSize` logical pixels square); `doc.plotTile(vx,vy,c)` maps view→tile via true modulo: `tx = ((vx % s) + s) % s` (same for y). This one mapping IS the torus wrap — lines, shapes, and drags across any cell edge wrap automatically because every rasterized pixel is wrapped independently.
- Changing `cellSize` resamples both buffers with `resizeNearest` (and re-clears the border center). Push an undo snapshot first.

**Undo/redo** (`state/history.ts`): snapshot-based, per-mode stacks (undo in border mode must not revert tile work). Entry: `{ mode, cellSize, buffer: Uint32Array copy }`. Push before every mutating gesture (pointer-down of a stroke/shape/fill, clear, resize). Cap 64 entries per mode (worst case 192×192×4 ≈ 147 KB each — fine). Redo stack cleared on any new mutation. `Ctrl/Cmd+Z` undo, `Ctrl/Cmd+Shift+Z` and `Ctrl/Cmd+Y` redo.

**Project JSON** (`state/persist.ts`):

```json
{
  "app": "pattern-maker",
  "version": 1,
  "savedAt": "2026-08-09T00:00:00Z",
  "mode": "border",
  "cellSize": 16,
  "color": "#232320",
  "border": { "w": 48, "h": 48, "data": "<base64 raw RGBA>" },
  "tile":   { "w": 16, "h": 16, "data": "<base64 raw RGBA>" }
}
```

Import validates `app`/`version` and dimensions (`border.w === 3·cellSize`, etc.); on failure, reject with an LCD message (brand voice: `couldn't read that file`), never partially load. Autosave: serialize to `localStorage["pattern-maker.project.v1"]`, debounced ~500 ms after `dirtyDoc` changes; load on boot if present, else start with a small welcome mark (brand: orange, considered — e.g. a simple corner motif in border mode). Save = download `pattern.json`; Load = `<input type=file>` → import.

## 5. Core algorithms

**Crisp zoomed rendering** (`editor/grid-editor.ts`):
- Logical size `L = 3·cellSize` (both modes' views are L×L logical pixels).
- Integer device zoom: `z = max(1, floor(availableCssPx · devicePixelRatio / L))`. Backing store `canvas.width = canvas.height = L·z`; CSS size `canvas.style.width = (L·z / devicePixelRatio) + 'px'`. Integer zoom × exact CSS size = no fractional sampling, ever.
- Keep one offscreen canvas at native L×L (border: putImageData of the sheet; tile: putImageData of the tile into a cellSize² offscreen, then draw it 9× into an L×L offscreen). Display: `ctx.imageSmoothingEnabled = false; ctx.drawImage(offscreen, 0, 0, L·z, L·z)`.
- Recompute `z` on ResizeObserver + `matchMedia('(resolution: …)')` DPR changes.
- Chrome (`editor/chrome.ts`), drawn after the art at device scale: transparency checkerboard *under* the art (two grays from the token family, small squares); cell delineation — border mode: 1px hairline `--key-border` lines at thirds; tile mode: *faint* delineation per spec (same lines at low alpha, e.g. `rgba(35,35,32,.18)`); border mode center cell: hatched/dimmed overlay + tiny `locked` mono label to communicate un-drawability.
- Pointer→pixel: `x = floor((e.clientX − rect.left) / rect.width · L)`, clamp to [0, L). Track with pointer capture like the demo. Report hover to store for the LCD (`x 042 y 156` zero-padded to 3).

**Raster primitives** (`raster/raster.ts`) — all pure, all emitting through a `plot(x, y)` callback so mode semantics (center lock, torus) live in `doc.ts`, not in the algorithms:
- `line(x0,y0,x1,y1,plot)` — integer Bresenham. Pencil strokes call it between consecutive pointer samples (no gaps on fast drags); the line tool calls it once on commit.
- `rectOutline(x0,y0,x1,y1,plot)`; `ellipseOutline` — midpoint ellipse from the drag's bounding box.
- `floodFill(getPx, setPx, w, h, x, y, replacement, wrap: boolean)` — scanline flood over u32s (adapt the demo's span-filling approach from canvas ImageData to PixelBuffer). `wrap=true` (tile mode) treats neighbors mod w/h — torus flood; guard with a visited bitset since "off the edge" no longer terminates. `wrap=false` (border mode) bounds-checks and additionally never enters the locked center region.
- Shape preview: on pointer-down of line/rect/ellipse, snapshot the buffer; each move restores the snapshot and re-rasterizes at the current drag point; pointer-up commits. Buffers are ≤147 KB — recompute is trivially cheap.

**Border-image sheet + CSS snippet** (`export/css.ts`): the border buffer *is* the sheet — no assembly step. Snippet (C = cellSize, URI from `compose.ts`):

```css
.bordered {
  border: <C>px solid transparent;
  border-image: url("data:image/png;base64,…") <C> round;
  image-rendering: pixelated;
}
```

Slice math: for a raster image, an unitless `border-image-slice` value is pixels, so the slice is exactly `C` — the guides at thirds. Emit `round` in the copied shorthand (best default) with a one-line comment listing the alternatives: `/* repeat | stretch | space also work */`. Tile mode snippet:

```css
.tiled {
  background-image: url("data:image/png;base64,…");
  background-repeat: repeat;
  background-size: <C·4>px <C·4>px;   /* 4× zoom so the pixels read; drop for 1:1 */
  image-rendering: pixelated;
}
```

Copy via `navigator.clipboard.writeText`, confirm on the LCD (`css copied`).

**Live previews** (`preview/`): regenerate a PNG data URI from the current buffer (offscreen canvas → `toDataURL('image/png')`), debounced ~150 ms during drawing and immediately on pointer-up.
- Border mode: four sample boxes in a right-hand column, each ~120–160 px square with visible content inside, labeled in lowercase mono (`stretch`, `repeat`, `round`, `space`), each styled inline with `border: Cpx solid transparent; border-image: url(uri) C <repeat>; image-rendering: pixelated` — real CSS border-image, not a simulation. Size the boxes so width isn't a multiple of the slice (repeat vs round vs space actually look different).
- Tile mode: one large swatch (~full column) with `background: url(uri) repeat` at native size, plus a second swatch at `background-size: 4C 4C` zoom. Both `image-rendering: pixelated`.
- PNG export (`export/png.ts`): border → the 3C×3C sheet; tile → the single C×C tile. Filename `pattern.png` (brand rule §7).

## 6. Tools, hotkeys, undo

| Tool | Key | Behavior |
|---|---|---|
| pencil | `p` | Bresenham between pointer samples; single pixel per plot |
| eraser | `e` | pencil that plots transparent (0x0) — **not** paper color; outputs need alpha |
| line | `l` | drag; snapshot-preview; commit on up |
| rect | `r` | drag corner-to-corner, outline only |
| ellipse | `o` | drag bounding box, outline only |
| fill | `f` | flood; torus flood in tile mode; walls at locked center in border mode |
| eyedropper | `i` | click picks color under cursor into current color; also **Alt+click with any tool** |

Global: `Ctrl/Cmd+Z` undo, `Ctrl/Cmd+Shift+Z` / `Ctrl/Cmd+Y` redo, `1` border mode, `2` tile mode. Ignore keys when focus is in an input. Tools implement the `Tool` interface from `tools/types.ts`; the registry maps hotkeys and the toolbar builds keys from it.

**Carried over from the demo engine:** pointer capture plumbing, snapshot-based shape preview, snapshot undo, scanline flood-fill structure, hotkey wiring pattern, chip/LED/aria-pressed control wiring, the LCD tip vocabulary. **Not carried over:** brush/spray/symmetry, anti-aliased canvas stroking (we plot pixels, never `ctx.stroke` into the document), paper-colored eraser, the 30-cap single undo stack (ours is per-mode with redo).

## 7. UI layout & brand

Structure (all inside the `.device` shell with corner screws, masthead `pattern maker` + `PM–1` badge + `professional pattern instrument` + power LED, exactly as the demo):

```
┌ device ──────────────────────────────────────────────┐
│ masthead                                             │
│ toolbar row: [tool keys+LEDs] [mode · border tile]   │
│              [cell · − 016 +]                        │
│ ┌ bezel: grid editor ┐  ┌ output column ───────────┐ │
│ │ (charcoal, canvas) │  │ border: 4 labeled boxes  │ │
│ │                    │  │ tile: repeat swatches    │ │
│ └────────────────────┘  └──────────────────────────┘ │
│ deck: color · current chip · 16 chips · custom well  │
│       transport: undo redo clear save load css export│
│ lcd: tool ─ x ─ y ─ mode ─ cell ─ tip ▊              │
└──────────────────────────────────────────────────────┘
```

Brand elements to reuse (copy CSS from the demo, adapt geometry):
- Tokens: the full `:root` block (`--ground` dot-grid page, `--plastic`, `--key`, `--key-border`, `--key-shadow`, `--charcoal`, `--lcd-text`, `--ink`, `--label`, `--orange`, `--paper`, both font stacks) → `styles/tokens.css` verbatim.
- Controls: `.key` cap (2px hard shadow, `:active` depress via transform), tool LEDs (dark at rest, orange glow when active, active cap turns charcoal with orange icon), toggle-bank style for the **mode** switch (`mode · border tile`, active segment solid orange/white — same as the demo's sym bank), 19px circular chips with orange selection ring, custom-color conic well, `.t-key` transport keys (glyph above, mono label below; **export** is the single `primary` orange key), charcoal bezel with inset shadow around the editor canvas, LCD strip with dim labels / lcd-text values / orange live values / blinking block cursor, corner screws, focus-visible orange outline everywhere, `prefers-reduced-motion` guards on cursor blink and key travel.
- The 16 drawing chips: exactly the demo's `CHIPS` array (BRANDING.md §3 — they are part of the brand).
- Cell-size control: a stepper reading as hardware — `−` key, 3-digit zero-padded mono readout (`016`), `+` key; value also mirrored on the LCD.
- Icons: inline SVG line icons, stroke 1.6, `currentColor`, ~21px on 42px keys (reuse demo icons; draw eyedropper new in the same style).
- Voice: all labels lowercase one-word mono; LCD tips deadpan (`draws on all nine. that's the point`, `center stays empty. css says so`); no exclamation points, no emoji.
- Mode 1 vs 2 chrome differences: border mode shows the locked-center hatch and normal hairline delineation; tile mode shows faint delineation only.
- Responsive: below ~880px stack editor above output (as the demo stacks its panel); fine to be minimal — desktop is the target.

## 8. Acceptance criteria

Verify each by hand in `npm run dev` (Chrome + one of Firefox/Safari):

1. `npm run dev` serves the app; `npm run build` passes with zero TypeScript errors under the strict config; no runtime dependencies in package.json.
2. Pencil paints exactly one logical pixel per plot; rendered pixels are crisp (no blur/bleed) at default zoom and on a HiDPI display; hairline grid delineation at thirds is visible in both modes (faint in tile mode).
3. Border mode: the center cell cannot be drawn into by any tool (pencil drag across it, line through it, rect over it, flood beside it) and renders with a visible locked treatment; exported PNG has a fully transparent center.
4. Tile mode: drawing a single stroke appears in all nine grid sections simultaneously; dragging a line from one section across the edge into another continues seamlessly on the opposite edge (torus); flood fill wraps across edges; exported PNG is a single C×C tile that tiles seamlessly.
5. All seven tools work in both modes and activate via their hotkeys with correct LED/key state; Alt+click color-picks with any tool.
6. Undo/redo works across strokes, shapes, fills, clear, and cell-size changes; stacks are per-mode; Ctrl/Cmd+Z / +Shift+Z / +Y all function.
7. Border mode preview: all four `border-image-repeat` variants (stretch/repeat/round/space) render live via real CSS border-image, update while drawing (≤ ~150 ms debounce after pointer-up), and visibly differ from each other with a suitable test drawing.
8. Copying the border-mode CSS snippet and pasting it into a scratch HTML page renders the drawn border correctly on a div; same for the tile-mode snippet as a repeating background.
9. Tile mode preview shows the tile repeating live (native + zoomed swatch), pixelated, no seams.
10. Cell size stepper changes resolution (8–64), resamples existing artwork, and previews/exports track the new size and slice value.
11. Reload restores the autosaved project (mode, cell size, both buffers, current color). Save downloads `pattern.json`; loading that file into a fresh session (cleared localStorage) restores the drawing exactly; a corrupt file is rejected with an LCD message and no state damage.
12. Visual audit against BRANDING.md: tokens only (no stray colors), orange appears solely on state/action, lowercase mono labels, key caps depress, LCD readouts zero-padded tabular, focus-visible rings, reduced-motion respected.

## 9. Implementation order (each phase leaves the app runnable)

1. **Scaffold + shell** — `.gitignore`, package.json, tsconfig, index.html, `styles/` with tokens + device chrome, static masthead/toolbar/deck/LCD (dead controls). App runs and *looks* like PM–1. Commit.
2. **Buffer + editor + pencil (border mode only)** — PixelBuffer, doc with center lock, grid-editor with crisp zoom/DPR/pointer mapping, chrome (checkerboard, delineation, lock hatch), pencil + eraser via Bresenham, LCD coords live.
3. **History + full toolset** — undo/redo, line/rect/ellipse with snapshot preview, flood fill, eyedropper + Alt-pick, hotkeys, chips + custom color wired.
4. **Tile mode** — tile buffer, view→tile modulo plotting, torus flood, mode toggle bank, per-mode chrome, hotkeys `1`/`2`.
5. **Previews + exports** — compose/debounce, 4-box border preview, tile swatches, CSS snippets + clipboard, PNG download.
6. **Persistence** — JSON schema, base64 codec, localStorage autosave/restore, save/load keys, import validation.
7. **Polish pass** — cell-size stepper + resample, LCD tips per tool/mode, welcome mark, focus/reduced-motion audit, brand audit against §8.12.

## 10. Risks / notes for the implementer

- **Data-URI size in previews:** at 64px cells the border sheet is 192×192 — PNG data URIs stay small (KBs); the 150 ms debounce keeps `toDataURL` off the pointermove hot path. Do not regenerate previews per plotted pixel.
- **`border-image` sample boxes need transparent borders and `border-style: solid`** or nothing renders in some browsers — the snippet in §5 already includes both; keep them in the preview styling too.
- **Torus flood fill must track visited pixels** (bitset) — with wrapping, "hit the edge" no longer terminates spans.
- **DPR changes mid-session** (window dragged between monitors) must retrigger zoom math — ResizeObserver alone won't catch it; use the `matchMedia` resolution trick or re-check DPR on each render.
- Keep `raster/` and `state/doc.ts` free of DOM/browser-global assumptions beyond typed arrays — that's the Tauri-readiness seam.

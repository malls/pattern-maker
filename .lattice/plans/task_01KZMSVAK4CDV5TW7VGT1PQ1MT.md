# PM-7: Rect select with copy/paste (floating paste, both modes)

Self-contained plan. Ground truth: PM-3 through PM-6 are implemented and live; read `BRANDING.md` §3–8 before touching UI. All paths relative to the repo root.

## 0. What exists today (read before changing)

- **Tools** (`src/tools/types.ts`): `Tool { id, hotkey, label, tip, onDown/onMove/onUp }` receiving logical **view coordinates** (`Pt`) and a `ToolContext` (`plot/erase/fill/pick/snapshot/restore/beginStroke/commit`). Tools never touch the doc directly; mode semantics (border center lock, tile torus) live in `src/state/doc.ts` (`plotView`, `getViewPx`, `floodView`). Registry + hotkey map in `src/tools/index.ts`; toolbar keys are built from the registry in `main.ts`.
- **Grid editor** (`src/editor/grid-editor.ts`): owns the art rect (`z`, `ox/oy`, `Lf`, `fx0/fy0` — the PM-4 focus window), `toPt()` clamping rules (unfocused → `[0,L)`; focused border → the cell; focused tile → cell ± one cell of raw margin so strokes wrap), pointer capture, and the `ToolContext` implementation. `pointerdown/move` while drawing bump `dirtyDoc` (which drives render + debounced previews + autosave).
- **Chrome** (`src/editor/chrome.ts`): checker/delineation/center-lock/mini-map, drawn at device scale; delineation and lock are drawn under `ctx.translate(ox, oy)` so they draw from origin.
- **State** (`src/state/store.ts`): `AppState { mode, tool, color, colorHex, cellSize, focus, hover, dirtyDoc, dirtyPreview, tip }`. Buffers live in `Doc` (never copied through the store); counters drive invalidation. `focus` is the precedent for ephemeral view state.
- **History** (`src/state/history.ts`): per-mode snapshot stacks; `history.push(hist, doc, mode)` before a mutating gesture = one undo step. Coordinate-free.
- **Keyboard** (`src/main.ts`): one `keydown` handler — input guard, then ctrl/meta branch (z/y), then Alt bail, then `Escape` (exits focus only), then arrows (move focus while focused), then `z`, `1`, `2`, then tool hotkeys.
- **Used bare hotkeys:** `p e l r o f i z 1 2`. Free: `m` (and `s`, which stays reserved for the future symmetry bank — BRANDING §9).
- **LCD** (`src/ui/lcd.ts`): segments tool / x·y / mode / cell / focus / tip; dim labels, orange `b` for live values. Toolbar (`src/ui/toolbar.ts`): `ICONS` record keyed by tool id, keys auto-built from the registry.

## 1. Scope and fixed decisions

**Delivers:** a `select` tool (rect marquee), internal copy/cut/paste with a floating paste the user positions (pointer drag + arrows) and stamps (Enter / click outside) or cancels (Esc), working in both modes and while focused (PM-4).

**Decisions (justified once, do not relitigate):**

1. **Marquee lives in view coordinates** (`0..L-1`, the space tools already speak). Border: a marquee may span multiple cells — it is one 3C×3C buffer; the locked center just yields transparent on copy and rejects on stamp. Tile: the marquee is taken in view space and **copy samples through `getViewPx`**, i.e. through the torus — copying across a cell seam reads the wrapped content, which is exactly what the user sees.
2. **Stamp is verbatim replace** — every pixel of the float, including fully transparent ones, overwrites the destination via `plotView`. Rationale: exact cut/paste round-trip (transparent pixels restore holes), it matches the existing eraser semantics ("plots transparent, not paper"), and it makes the float preview honestly WYSIWYG (see §4). Skipping transparent pixels would need a second compositing rule and a preview that lies. Border clipping (locked center, out-of-bounds) and tile wrapping come **free** from `plotBorder`/`plotTile`.
3. **Cut = copy + erase, one undo entry. Stamp = one undo entry.** Paste/move/cancel touch no doc state and push no history. **Undo or redo while a float is live cancels the float and does nothing else** (the float never entered the doc, so "undo the paste" is just dropping it).
4. **Clipboard is a module-level in-memory `PixelBuffer`** in `main.ts` (like `lastFocus`). It survives mode switches, cell-size changes, and focus changes; it is not persisted and does not touch the system clipboard (system-clipboard PNG export is out of scope).
5. **Hotkey `m`** ("marquee", Photoshop convention). `s` stays free for symmetry. Tool appended last in the registry (after eyedropper) so existing key positions don't move.
6. **`rect` and `float` are mutually exclusive selection states.** Pasting clears the rect; stamping re-selects the stamped bounds (so immediate re-copy/re-cut works); canceling clears both.
7. **Anything that changes what's under the float commits it first ("stamp on context change"):** tool switch away from select, mode switch, cell-size change, focus enter/exit → `stampFloat()` first. Exception: **project load and clear cancel** the float (stamping into a document that's about to be replaced/wiped is noise). A committed rect (no float) is simply cleared by all of the above — it's ephemeral view state, same policy as `focus`.
8. **Selection does not mask other tools.** Switching to pencil with a selection active clears the selection; no draw-inside-selection semantics. Out of scope, as is Ctrl/Cmd+A select-all.
9. **Marquee rendering is a static two-tone dashed hairline** — 1 device px, dash segments alternating `--orange #FF4E00` and `--paper #FBFAF8` (alternation guarantees contrast over any artwork; orange because a selection is live state). **Not animated**: BRANDING §8 permits exactly one idle animation (the LCD cursor). No `prefers-reduced-motion` concern because nothing moves. Float gets the same ants; the LCD carries the "floating" distinction.

## 2. State model

**New `src/state/selection.ts`** (DOM-free, like `doc.ts` — the Tauri seam holds):

```ts
export interface SelRect { x: number; y: number; w: number; h: number } // view coords, normalized, w/h ≥ 1
export interface Float { buf: PixelBuffer; x: number; y: number }       // top-left in view coords
export interface SelectionState { rect: SelRect | null; float: Float | null }
export function createSelection(): SelectionState;

/** read a view-space rect into a new buffer via getViewPx (tile: wraps; border: locked center reads 0) */
export function copyRect(doc: Doc, mode: Mode, r: SelRect): PixelBuffer;
/** erase a view-space rect via plotView(…, 0) (tile: wraps; border: center/OOB reject) */
export function eraseRect(doc: Doc, mode: Mode, r: SelRect): void;
/** stamp the float verbatim via plotView — border clips, tile wraps */
export function stampFloat(doc: Doc, mode: Mode, f: Float): void;
/** clamp a float position into a window [wx0, wx0+ww−buf.w] (per axis), used by drag + nudge + paste */
export function clampFloatPos(f: Float, wx0: number, wy0: number, ww: number, wh: number): { x: number; y: number };
```

**Store** (`src/state/store.ts`): add `dirtySel: number` — bumped on any selection/float change; drives grid-editor re-render **only** (never previews, never autosave). The `SelectionState` object itself is held by `main.ts` and passed by reference to the grid editor (exactly the `doc` pattern); the LCD gets a small descriptor via `syncAll`.

**Coordinate/window rules:**
- Marquee points clamp to the **visible window** `[fx0, fx0+Lf)` in every state — including focused tile mode, where drawing tools get one cell of raw margin but a marquee beyond the window would select what you can't see. (Tile content is C-periodic so nothing is unreachable.)
- Float position is clamped fully inside the current window (`clampFloatPos`). In tile mode every wrap phase stays reachable (window ≥ C wider than any ≤2C float); in border mode edge-cropping-by-overhang is deliberately not supported.
- **Paste targets the current window**, float centered: `x = fx0 + floor((Lf − w)/2)`. If the clipboard doesn't fit the focused window (`w > Lf || h > Lf`), exit focus first (tip: `back to nine. it didn't fit`), then paste into the full view. If it somehow exceeds even L (paste after shrinking cells), clip the pasted buffer to L×L top-left on paste.

## 3. The select tool and pointer flow

**`src/tools/types.ts`** — two additions, both optional so all existing tools are untouched:

```ts
export interface Tool {
  …
  /** never mutates the doc: gestures bump dirtySel, not dirtyDoc (no preview/autosave churn) */
  readonly passive?: true;
  /** toPt clamps to the visible window even in focused tile mode (no raw margin) */
  readonly clampToWindow?: true;
}
```

`ToolContext` gains selection ops (implemented in grid-editor, delegating to injected deps):

```ts
/** live-update the marquee rect during a drag (normalized by the caller); null deselects */
setSelection(r: SelRect | null): void;
getSelection(): SelRect | null;
/** float geometry or null */
getFloat(): { x: number; y: number; w: number; h: number } | null;
/** move the float (window-clamped by the implementation) */
moveFloatTo(x: number, y: number): void;
/** stamp the float into the doc (one undo entry) — delegates to main's action */
stampFloat(): void;
```

**New `src/tools/select.ts`** — `id: "select"`, `hotkey: "m"`, `label: "select"`, `tip: "box it up. then copy cut paste"`, `passive: true`, `clampToWindow: true`. Gesture machine:

- **No float:** `onDown` records the anchor and sets a 1×1 rect; `onMove` sets the normalized rect anchor→p (inclusive: `w = |dx|+1`); `onUp` — if the pointer never left the anchor pixel (pure click), `setSelection(null)` (click deselects; a deliberate 1×1 selection is unreachable and that's fine).
- **Float, down inside float bounds:** record grab offset; `onMove` → `moveFloatTo(p.x − gx, p.y − gy)`; `onUp` ends the drag.
- **Float, down outside float bounds:** `ctx.stampFloat()` and swallow the gesture (the same press does not start a marquee — matches "click outside commits"). Letterbox clicks are already gated off by `inArt` and do nothing, by design; Enter always works.

The tool never calls `beginStroke`/`plot`/`commit` — history for cut/stamp is pushed inside the actions (§5).

**Grid-editor pointer pipeline** (`src/editor/grid-editor.ts`):
- `toPt()`: when `getTool().clampToWindow` and focused, clamp to `[fx0, fx0+Lf−1]` both modes (one extra branch beside the existing three).
- `pointerdown/move/up`: where the pipeline currently calls `bumpDoc()` around tool callbacks, call `bumpSel()` (`dirtySel+1`) instead when `getTool().passive` — selection drags must not tickle previews/autosave.
- `GridEditorDeps` gains `sel: SelectionState` and `stampFloat(): void`; `toolCtx` implements the five new methods with them (`setSelection` mutates `sel.rect` + bumps `dirtySel`; `moveFloatTo` applies `clampFloatPos` against the current window `fx0/fy0/Lf`).

## 4. Rendering (float + marching ants)

In `render()` after composing `offNative` (the L×L view):

1. **Float compositing — verbatim, honest:** if `sel.float` exists, keep a small offscreen (`offFloat`) sized `buf.w×buf.h`, `putImageData` the float buffer, then on `offNativeCtx`: `clearRect(f.x, f.y, w, h); drawImage(offFloat, f.x, f.y)`. Clearing first makes the float **replace** the art underneath — checker shows through the float's transparent pixels — which is exactly what stamping will do (§1.2). In tile mode the float is drawn once at its position, not ×9 (it isn't in the tile yet); the paste tip says it will wrap.
2. **Ants:** new `drawMarquee(ctx, x, y, w, h, z)` in `src/editor/chrome.ts`, called under the existing `ctx.translate(ox, oy)` with window-local coords (`(r.x − fx0)·z`, …). Draw the 1-device-px rect boundary just outside the selected pixels as four dashed hairlines: fill 4-device-px segments alternating `#FF4E00` and `#FBFAF8` (use `fillRect` runs, not `stroke`, to stay crisp). Source rect: `sel.float` bounds if a float exists, else `sel.rect`. Clip to the art rect (`ctx.save(); ctx.beginPath(); ctx.rect(0,0,Lf·z,Lf·z); ctx.clip()`) so a rect partially outside a focused window can't paint the letterbox.
3. **Invalidation:** extend the store subscription with `s.dirtySel !== prev.dirtySel → requestRender()` (no relayout).

## 5. Actions, clipboard, keyboard

All in `src/main.ts` (beside the focus actions). Module state: `let clipboard: PixelBuffer | null = null;` plus `const sel = createSelection()`. Helper `bumpSel(patch?)` bumps `dirtySel`.

| Action | Behavior | LCD tip |
|---|---|---|
| `copySel()` | needs `sel.rect` → `clipboard = copyRect(...)` | `copied {w}×{h}` / `nothing selected. m marks` |
| `cutSel()` | copy + `history.push` + `eraseRect` + `bumpDoc` (one undo entry; selection kept) | `cut {w}×{h}` |
| `deleteSel()` | `history.push` + `eraseRect` + `bumpDoc` — no clipboard write | `erased` |
| `pasteClip()` | needs clipboard → doesn't fit focused window: `exitFocus` first; `sel.float = { buf: clone(clipboard), x, y }` centered in window, `sel.rect = null`, `setTool("select")` (auto-activate), `bumpSel` | `floating. drag it. enter stamps` / `nothing to paste` |
| `stampFloatAction()` | needs float → `history.push` + `stampFloat(doc, mode, f)` + `sel.rect = stamped bounds; sel.float = null` + `bumpDoc` | `stamped` |
| `cancelFloat()` | drop float (clipboard kept), `sel.rect = null`, `bumpSel` | `paste dropped` |
| `nudgeFloat(dx, dy)` | float position += delta, `clampFloatPos` to window, `bumpSel` | — |
| `deselect()` | `sel.rect = null`, `bumpSel` | `deselected` |

**Keyboard handler changes** (order matters — this is the whole precedence spec):

| Key | Condition | Action |
|---|---|---|
| Ctrl/Cmd+C | in ctrl branch, after z/y | `copySel()`; `preventDefault` only when a selection exists |
| Ctrl/Cmd+X | 〃 | `cutSel()`; same guard |
| Ctrl/Cmd+V | 〃 | `pasteClip()`; `preventDefault` when clipboard exists |
| Escape | **float → `cancelFloat()`; else rect → `deselect()`; else focus → `exitFocus()`** — selection always wins over focus-exit; still never swallowed when nothing applies | |
| Enter | float exists | `stampFloatAction()` |
| Arrows | **float exists → `nudgeFloat(±1, shift: ±8)` + `preventDefault`** — checked *before* the existing focus-arrows branch | |
| Delete / Backspace | rect exists, no float | `deleteSel()` |
| `m` | via registry | select tool (no registry-code change needed) |

**Undo/redo guard:** at the top of `doUndo`/`doRedo`: `if (sel.float) { cancelFloat(); return; }` (§1.3).

## 6. Lifecycle integration (stamp-on-context-change)

| Existing action | Add |
|---|---|
| `setTool(id)` | if leaving `select` (or any tool) while `sel.float` → `stampFloatAction()` first; entering any non-select tool clears `sel.rect` |
| `setMode()` | float → stamp (into the outgoing mode) first; then clear `sel.rect`, bump `dirtySel` |
| `setCell()` | float → stamp first (before `pushBoth`/resample — coords still valid); clear `sel.rect` |
| `enterFocus()` / `exitFocus()` / `toggleFocus()` | float → stamp first; clear `sel.rect` (window changed) |
| `applyProject()` (load) | **cancel** float, clear rect (doc is being replaced — §1.7 exception) |
| `doClear()` | **cancel** float, clear rect, then clear as today |

`moveFocus` needs no change — arrows are owned by the float while one exists.

## 7. UI: toolbar, LCD, styles

- **`src/ui/toolbar.ts`:** add `ICONS.select` — dashed rect in the house style: `<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4.5" y="5.5" width="13" height="11" stroke-dasharray="3 2.2"/></svg>`. Nothing else: the key, LED, hotkey title, and `aria-pressed` all come from the registry plumbing.
- **`src/ui/lcd.ts`:** `LcdState` gains `sel: { w: number; h: number; floating: boolean } | null`; new segment after `focus`: dim label `sel`, value `—` when null, orange `b` `{w}×{h}` when set (floating adds nothing visual — the tip line narrates). `main.ts#syncAll` builds the descriptor from `sel` (rect or float bounds).
- **`src/styles/app.css`:** no changes expected (ants are canvas-drawn; no new DOM). No new colors anywhere — orange/paper/ink only (§1.9).

## 8. Exact changes per file

| File | Change |
|---|---|
| `src/state/selection.ts` **(new)** | `SelRect`, `Float`, `SelectionState`, `createSelection`, `copyRect`, `eraseRect`, `stampFloat`, `clampFloatPos`. Pure, DOM-free, built on `getViewPx`/`plotView`/`PixelBuffer` only. |
| `src/tools/select.ts` **(new)** | The select tool per §3. |
| `src/tools/types.ts` | Optional `Tool.passive` / `Tool.clampToWindow`; five selection methods on `ToolContext`. |
| `src/tools/index.ts` | Register `selectTool` (appended last). |
| `src/state/store.ts` | `dirtySel: number` + doc comment (selection is ephemeral view state — never persisted, never in history). |
| `src/editor/grid-editor.ts` | Deps gain `sel`, `stampFloat`; `toolCtx` selection methods; `toPt` window clamp for `clampToWindow` tools; `bumpSel` for passive tools; float compositing + `drawMarquee` call in `render()`; `dirtySel` invalidation. |
| `src/editor/chrome.ts` | `drawMarquee(ctx, x, y, w, h, z)` — two-tone dashed hairline per §4. |
| `src/main.ts` | Clipboard + `sel` state; eight actions (§5); keyboard branches (§5); lifecycle hooks (§6); `syncAll` sel descriptor; initial `dirtySel: 0`. |
| `src/ui/toolbar.ts` | `ICONS.select`. |
| `src/ui/lcd.ts` | `sel` segment. |
| *(no changes)* | `doc.ts`, `history.ts`, `persist.ts`, `raster/*`, `preview/*`, `export/*`, other tools, `app.css`. If one of these needs edits, stop and re-check — the seams are supposed to hold. |

## 9. Acceptance criteria (verify by hand in `npm run dev`; `npm run typecheck` clean)

1. `m` (and the toolbar key, with LED/charcoal-cap active state) activates select; dragging draws a live two-tone dashed marquee, crisp at 1 device px on 1× and HiDPI; a plain click deselects; the LCD shows orange `sel {w}×{h}` and `—` when none. Ants do not animate.
2. **Border, multi-cell marquee:** a marquee spanning several cells (including over the locked center) copies; pixels from the locked center come back transparent.
3. **Cut leaves transparency:** Ctrl/Cmd+X erases the marked region to checker (not paper) in one undo step; Ctrl/Cmd+Z restores it in one step; the selection survives the cut. Delete/Backspace erases without touching the clipboard.
4. **Paste floats:** Ctrl/Cmd+V auto-activates select, shows the buffer centered in the current window with ants, checker visible through its transparent pixels; drag from inside moves it; arrows nudge ±1, shift+arrows ±8; the float never leaves the window.
5. **Stamp:** Enter — and clicking outside the float — stamps in **one undo entry**; undo after stamp restores the exact pre-stamp state in one step; after stamping, the stamped bounds are selected again.
6. **Cancel:** Esc drops the float without touching the doc; the clipboard survives and Ctrl/Cmd+V pastes it again. Ctrl/Cmd+Z while floating drops the float and consumes no history.
7. **Tile torus:** copy in tile mode across a cell seam → contents match what was on screen. Paste, arrow-move the float against the window edge, stamp near the edge (or with a buffer wider than C): stamped pixels **wrap** through `plotTile` and all nine sections update; previews live-update after stamp/cut but do **not** regenerate (and autosave does not fire) during marquee drags or float moves.
8. **Border clipping:** stamping a float overlapping the locked center clips silently — center stays empty, the rest lands; stamping partially against the sheet edge clips (float can't leave the window anyway).
9. **Esc precedence:** while focused with a float: Esc #1 drops the float, Esc #2 clears any selection, Esc #3 exits focus. Esc with none of these active is not swallowed.
10. **Focus interplay:** marquee while focused clamps to the visible cell in both modes; paste while focused centers in the cell; a clipboard bigger than the focused cell exits focus and pastes into the full view (tip `back to nine. it didn't fit`); entering/exiting focus, switching mode, switching tool, or stepping cell size with a live float stamps it first; load/clear drop it.
11. **No regressions:** all seven drawing tools, Alt-pick, focus (`z`/arrows/Esc), undo/redo, previews, autosave, save/load behave exactly as before when the select tool is not involved (`passive`/`clampToWindow` are opt-in flags).
12. **Brand audit:** ants use orange/paper only; the select key/LED matches tool vocabulary; LCD label dim + value orange; all copy lowercase deadpan; no new CSS colors; nothing animates that didn't before.

## 10. Implementation order (app runnable after every step)

1. **Marquee:** `selection.ts` (state + `copyRect`/`eraseRect` stubs fine), `dirtySel`, tool flags + `ToolContext.setSelection/getSelection`, `select.ts` (marquee half), `toPt` clamp, `bumpSel` routing, `drawMarquee`, LCD segment, toolbar icon, Esc-deselect + tool/mode/focus clearing. Verify criteria 1–2, 9 (partial), 11–12. Commit.
2. **Copy/cut/delete:** clipboard, `copySel`/`cutSel`/`deleteSel`, ctrl-branch keys, undo behavior. Verify 2–3, tile-copy half of 7. Commit.
3. **Float:** `Float` state, `clampFloatPos`, `stampFloat`, float compositing in `render()`, select-tool float gestures, `pasteClip`/`stampFloatAction`/`cancelFloat`/`nudgeFloat`, Enter/Esc/arrow/undo-guard branches. Verify 4–8. Commit.
4. **Lifecycle + polish:** §6 hooks, focused-window paste rules, tips pass, full acceptance run + `npm run typecheck`. Commit.

## 11. Risks / notes for the implementer

- **The pointer pipeline is shared by every tool** — `passive`/`clampToWindow` must default to today's behavior; touch nothing in the non-select paths. Criterion 11 is the regression gate.
- **Don't route selection changes through `dirtyDoc`:** the preview debouncer and autosave both subscribe to it; marquee drags at pointer-move frequency would churn `toDataURL` and `localStorage` for nothing. `dirtySel` exists precisely to avoid this.
- **Stamp before resample, not after**, in `setCell` — float coordinates are in the *current* cell size; stamping after `setCellSize` would land scaled-wrong. (Stamp + cell change = two undo entries; that's correct, they are two gestures.)
- **Tile stamps wider than C** overwrite themselves while wrapping — last write wins, deterministic; not a bug, don't "fix" it.
- **`clearRect`-then-`drawImage` is what makes the float preview verbatim** — plain `drawImage` would source-over-composite and show a lie for transparent float pixels.
- **Enter key vs the cell-size readout input:** the readout swaps in a real `<input>`, and the global handler already bails on inputs — keep the Enter branch after that guard, and there's no conflict.
- Keep `selection.ts` DOM-free (typed arrays + doc functions only) — the Tauri seam from PM-3 still applies.

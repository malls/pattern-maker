# PM-10: clicking on a shape tool that is already selected should toggle between filled and border only shape drawing

Re-clicking the **already-active** rect or ellipse key flips that tool between outline (today's
behaviour) and filled. Fill uses the current color. The key's icon changes so the mode is visible
at a glance. Nothing else about shape drawing changes.

Read before starting: `BRANDING.md` (§3 color, §5 controls, §6 iconography, §7 voice) and
`.lattice/plans/task_01KZMKJV0YMKXHFX6MAR5J37AN.md` §5–6 (the plot-callback contract and the tool
table). This plan assumes the code as of `955d6b7`.

---

## 1. Scope

**In:** filled variants of the rect and ellipse rasterizers; per-tool session-only fill flags in the
store; re-click / re-press detection in `setTool`; a filled key icon; an LCD readout; LCD tips.

**Out (do not build):** filled variants for any other tool; a separate "fill mode" toggle bank or
stepper in the toolbar (the shape key *is* the control); persisting the flags; stroke-width /
outline-color options; changing what the line tool does.

### 1.1 Which tools participate

| Tool | Participates | Re-click behaviour |
|---|---|---|
| rect | yes | toggles rect's fill flag |
| ellipse | yes | toggles ellipse's fill flag |
| line | **no** | unchanged: re-selecting re-states the tip, nothing else |
| pencil / eraser / fill / eyedropper / select | no | unchanged |

Line is excluded because a 1px polyline has no interior — "filled line" has no meaning, and giving
the key a state that never changes its output would be a lie told by an LED. Its key must therefore
never render a filled glyph and never carry the `data-fill` attribute (see §5), so the absence of a
reaction is itself legible: the keys that toggle *look* like they toggle.

### 1.2 Per-tool flags, not one shared flag

**Per-tool.** Two reasons:

1. The control is the tool's own key cap and the indicator is that key's own icon. With a shared
   flag, clicking rect would silently repaint the ellipse key — a control changing a control you
   didn't touch. That is exactly the kind of spooky action the device metaphor forbids.
2. The states are genuinely independent in use: outlined rect frames around filled ellipse dots is
   an ordinary pattern-making combination. Remembering each tool's last mode is free.

---

## 2. State model

Add to `AppState` in `src/state/store.ts`:

```ts
  /** which shape tools draw filled rather than outline-only. Keys are tool ids;
   *  only tools flagged `fillable` ever appear. Session-only UI state — never
   *  persisted, never in undo history, never bumps dirtyDoc/dirtyPreview.
   *  Replaced wholesale so subscribers can reference-compare (like `focus`). */
  shapeFill: Readonly<Record<string, boolean>>;
```

Initialised in `boot()` (`src/main.ts`) as `shapeFill: { rect: false, ellipse: false }` — outline is
the default, so a fresh session behaves exactly as it does today.

**Session-only, not persisted.** Precedents in this file: `focus` ("Ephemeral UI state — never
persisted") and `exportScale` ("Session-only UI state — never persisted … a restored project never
dictates it"). Decisive argument: the *tool itself* is not persisted — `boot()` always starts on
`pencil` regardless of the restored project — so persisting a sub-mode of a tool you won't be holding
is incoherent. Consequence: **no change to `src/state/persist.ts`, no project schema version bump.**

**Not in history.** Toggling fill mutates no pixels. It must not push an undo entry and must not
count as a doc change.

Because `tsconfig` sets `noUncheckedIndexedAccess: true`, `s.shapeFill[id]` is `boolean | undefined`.
Always read it as `s.shapeFill[id] === true` (or `!s.shapeFill[id]` when negating).

---

## 3. Re-click / re-press detection

`setTool` in `src/main.ts` already has the exact hook — the early return when the requested tool is
the active one:

```ts
  function setTool(id: string): void {
    const t = toolById(id);
    if (store.get().tool === t.id) {
      if (t.fillable) toggleShapeFill(t.id);   // ← new
      else store.set({ tip: t.tip });
      return;
    }
    commitFloatFirst();
    const patch = t.id === "select" ? {} : clearSelectionPatch();
    store.set({ ...patch, tool: t.id, tip: t.tip });
  }
```

New action beside `stepScale` (and documented the same way — a plain `store.set` on purpose):

```ts
  /** Re-selecting an already-active shape tool flips it between outline and
   *  filled. Plain store.set: the flag changes neither the document nor the
   *  previews, so it must bump neither dirtyDoc nor dirtyPreview — no preview
   *  regeneration, no autosave churn, no undo entry. */
  function toggleShapeFill(id: string): void {
    const s = store.get();
    const next = !s.shapeFill[id];
    store.set({
      shapeFill: { ...s.shapeFill, [id]: next },
      tip: next ? "filled. click again for outline" : "outline. click again for filled",
    });
  }
```

Properties this preserves, all of which matter:

- **First-click selection is untouched** — the `!==` branch is not modified.
- **No float stamping, no deselect, no focus change.** The early-return branch already runs before
  `commitFloatFirst()` / `clearSelectionPatch()`; toggling fill changes neither the window nor the
  document, so it must stay that way. (PM-7's float can never be live while rect is active anyway —
  `pasteClip()` forces `setTool("select")` — but the invariant should not depend on that.)
- **`pasteClip()`'s `setTool("select")` cannot toggle anything**: select is not `fillable`, so it
  takes the `else` branch exactly as today.

### 3.1 Hotkeys toggle too

Pressing `r` when rect is already active toggles it, because the hotkey dispatch funnels through the
same `setTool`. **Keep this** — in this app the hotkey and the key cap are the same control (the key
titles literally read `rect (r)`), and a hotkey that selects-but-never-toggles would be an invisible
divergence. The icon flip plus the LCD tip makes the effect self-evident.

One required guard: `keydown` fires repeatedly while a key is held, which would strobe the flag. In
the tool-hotkey branch at the bottom of the `keydown` handler:

```ts
    const tool = toolByHotkey(key);
    if (tool) {
      if (e.repeat) return;   // holding a tool key must not strobe the fill flag
      setTool(tool.id);
    }
```

Scope the guard to that branch only — do not touch the `z` / `1` / `2` branches in this task.

---

## 4. Rasterizers

`src/raster/raster.ts` has `line`, `rectOutline`, `ellipseOutline`, `floodFill`. **There are no
filled primitives — both must be written.**

### 4.1 The plot-callback contract (verified, non-negotiable)

Confirmed by reading the code: every primitive in `raster.ts` emits solely through
`plot(x, y): void` and never touches a buffer. `ToolContext.plot` in
`src/editor/grid-editor.ts:226` routes to `plotView(doc, mode, x, y, color)`, and `plotView`
(`src/state/doc.ts:64`) dispatches to `plotBorder` — which silently drops out-of-bounds writes and
writes inside the locked center — or `plotTile`, which applies `mod(v, cellSize)` per pixel (the
torus wrap). **Therefore the filled variants must use the identical signature
`(x0, y0, x1, y1, plot: Plot) => void` and emit every pixel through `plot`, never writing a
`PixelBuffer` and never bounds-checking or wrapping themselves.** Doing so is what makes "filled rect
over the locked center clips silently" and "filled ellipse wraps across the tile seam" fall out for
free, in both normal and focused views. A span loop that wrote into a buffer directly would break
both modes at once.

`raster.ts` also stays DOM-free and `Doc`-free.

### 4.2 `rectFilled`

```ts
/** Filled axis-aligned rectangle from any two corners (inclusive). */
export function rectFilled(x0: number, y0: number, x1: number, y1: number, plot: Plot): void {
  const lx = Math.min(x0, x1) | 0;
  const rx = Math.max(x0, x1) | 0;
  const ty = Math.min(y0, y1) | 0;
  const by = Math.max(y0, y1) | 0;
  for (let y = ty; y <= by; y++) {
    for (let x = lx; x <= rx; x++) plot(x, y);
  }
}
```

Trivially a superset of `rectOutline` over the same corners, so no separate outline pass is needed
(see §4.4). A 1×1 drag plots exactly one pixel, matching `rectOutline`'s degenerate case.

### 4.3 `ellipseFilled` — spans derived from the existing sampler

Do **not** write independent analytic scanline math. The existing `ellipseOutline` samples a quarter
arc parametrically and mirrors it four ways; independently-derived scanline extents would disagree
with it by a pixel here and there, and the two shapes would visibly differ for the same drag.

Instead extract the sampling loop (the body of `ellipseOutline` after its degenerate check) into a
private helper and drive both primitives from it:

```ts
/** Emit the ellipse-outline sample set for a bounding box. Private: the two
 *  public ellipse primitives share it so a filled ellipse and an outline
 *  ellipse of the same drag have byte-identical silhouettes. */
function ellipseSamples(lx: number, ty: number, rx: number, by: number, emit: Plot): void {
  /* … exactly the current loop from ellipseOutline: cx, cy, a, b, steps,
     the four plot() calls per step, unchanged … */
}
```

`ellipseOutline` keeps its signature, its degenerate `w === 0 || hgt === 0 → line(...)` branch, and
its emission order; its body becomes the degenerate check plus `ellipseSamples(lx, ty, rx, by, plot)`.
This is a pure refactor — **verify no pixel changes** by drawing an outline ellipse before and after.

```ts
/** Filled ellipse inscribed in the drag's bounding box. Spans run between the
 *  extreme sampled x of each row, so the filled shape's silhouette is exactly
 *  the outline's — by construction, not by two algorithms agreeing. */
export function ellipseFilled(x0: number, y0: number, x1: number, y1: number, plot: Plot): void {
  // normalize corners as in the other primitives
  if (w === 0 || hgt === 0) { line(lx, ty, rx, by, plot); return; }
  const rows = by - ty + 1;
  const lo = new Int32Array(rows).fill(0x7fffffff);
  const hi = new Int32Array(rows).fill(-0x80000000);
  ellipseSamples(lx, ty, rx, by, (x, y) => {
    const i = y - ty;
    if (i < 0 || i >= rows) return;               // defensive; the sampler clamps
    const l = lo[i] ?? 0; const r = hi[i] ?? 0;   // noUncheckedIndexedAccess
    if (x < l) lo[i] = x;
    if (x > r) hi[i] = x;
  });
  for (let i = 0; i < rows; i++) {
    const l = lo[i] ?? 0;
    const r = hi[i] ?? -1;
    if (r < l) continue;
    const y = ty + i;
    for (let x = l; x <= r; x++) plot(x, y);
  }
}
```

Notes for the implementer:

- Collecting into `lo`/`hi` costs one `Int32Array` pair of length ≤ 192 — nothing, and it happens
  once per pointermove at most.
- `noUncheckedIndexedAccess` makes `lo[i]` `number | undefined`; use the local-const-with-`??` shape
  above rather than non-null assertions.
- The emitted pixel order (rows top to bottom, left to right) does not matter: `plot` is idempotent
  for a solid color, and the outline already double-plots its mirrors today.

### 4.4 Fill only — no extra outline pass

**Recommendation: filled shapes draw the fill only.** Because both filled primitives are supersets of
their outline counterparts *by construction* (`rectFilled` trivially; `ellipseFilled` because its
spans are the per-row min/max of the very sample stream `ellipseOutline` plots), a second outline
pass would re-plot pixels that are already set and add a second source of truth for the silhouette.
The clean edge the outline pass would have bought is already guaranteed.

If — and only if — the implementer rejects §4.3 and writes independent analytic scanline math, then
they **must** also run `ellipseOutline` after the fill, since the two silhouettes would no longer be
guaranteed to agree. Prefer §4.3.

---

## 5. Wiring the tools

### 5.1 `src/tools/types.ts`

Two additions, both following the existing optional-flag vocabulary (`passive?: true`,
`clampToWindow?: true`):

```ts
export interface ToolContext {
  …
  /** true when the active tool is currently in filled mode (shape tools only) */
  readonly filled: boolean;
}

export interface Tool {
  …
  /** this tool has a filled variant: re-selecting it toggles outline/filled */
  readonly fillable?: true;
}
```

### 5.2 `src/editor/grid-editor.ts`

Add to the `toolCtx` literal, beside the existing `get size()`:

```ts
    get filled(): boolean {
      const s = store.get();
      return s.shapeFill[s.tool] === true;
    },
```

A getter, not a captured value: the active tool is by definition the one drawing, and reading live
means a mid-drag `r` press repaints correctly on the next move (the snapshot/restore machinery makes
every frame a full redraw anyway).

### 5.3 `src/tools/shape.ts`

```ts
export function makeShapeTool(
  id: string,
  hotkey: string,
  label: string,
  tip: string,
  raster: Raster,
  rasterFilled?: Raster,          // present ⇒ the tool is fillable
): Tool {
  let start: Pt | null = null;
  const draw = (to: Pt, ctx: ToolContext): void => {
    if (!start) return;
    const r = rasterFilled && ctx.filled ? rasterFilled : raster;
    r(start.x, start.y, to.x, to.y, (x, y) => ctx.plot(x, y));
  };
  …
  return { id, hotkey, label, tip, ...(rasterFilled ? { fillable: true as const } : {}), onDown, onMove, onUp };
}
```

`exactOptionalPropertyTypes: true` is on, so `fillable` must be spread conditionally — never passed
as `fillable: undefined`.

**Preview during drag is handled for free**: `onDown` snapshots, `onMove` restores + calls `draw`,
`onUp` restores + `draw` + `commit`. Since `draw` picks the raster per call, the live preview is
filled the moment the flag is on. No change to the snapshot/restore machinery.

**Undo is unchanged**: `ctx.beginStroke()` still fires exactly once, on `onDown`, before the first
mutation — one history entry per committed shape, filled or not.

### 5.4 `src/tools/rect.ts`, `src/tools/ellipse.ts`

Pass the filled rasters and extend the tips so the hidden interaction is discoverable the first time
the tool is selected (LCD tips are this app's teaching surface):

- `rectTool`: `rectOutline, rectFilled`; tip → `"drag corner to corner. click again to fill"`.
- `ellipseTool`: `ellipseOutline, ellipseFilled`; tip → `"circle-ish comes free. click again to fill"`.
- `lineTool`: unchanged — no sixth argument, so `fillable` stays absent.

---

## 6. Visual indication (the crux)

Two indicators, no new controls and no new colors.

### 6.1 The key icon: same glyph, filled — driven by CSS, not by markup swapping

The rect and ellipse icons are single shapes with `fill="none"` on the `<svg>` root:

```html
<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="6" width="14" height="10"/></svg>
<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.6"><ellipse cx="11" cy="11" rx="7" ry="5"/></svg>
```

A CSS rule beats a presentation attribute at any specificity, so the filled variant is one rule in
`src/styles/app.css`, placed next to the existing `.tool[aria-pressed="true"]` block:

```css
/* a fillable shape tool in filled mode: the same glyph, solid. still
   currentColor, so it is ink on plastic at rest and orange on the active
   charcoal cap — no new color, no icon swap. */
.tool[data-fill="on"] svg { fill: currentColor; }
```

The stroke stays, so the silhouette and optical weight do not shift — the icon reads as *the same
shape, filled in*, which is precisely the state it reports. Only rect and ellipse keys ever carry
`data-fill`, and both have single-shape icons, so the rule cannot leak into a multi-path icon.

**Do not swap `innerHTML` in `sync()`.** `syncAll` runs on *every* store notification, including the
hover updates fired on every `pointermove`; re-parsing SVG at that rate is wasteful, and worse, the
tool key's `.led` element is appended *after* the icon markup, so re-setting `innerHTML` would delete
the LED. `setAttribute` only.

**`src/ui/toolbar.ts` changes:**

1. `ToolbarSpec.tools` entries gain `fillable: boolean` (required, not optional — sidesteps
   `exactOptionalPropertyTypes` at the `main.ts` call site).
2. When building each tool key, if `t.fillable`, seed `"data-fill": "off"` in its `attrs` and record
   the key in a `fillKeys` map. Non-fillable keys never get the attribute.
3. `ToolbarView.sync` gains `shapeFill: Readonly<Record<string, boolean>>`, and its tool loop does:

```ts
      for (const [id, key] of fillKeys) {
        const on = state.shapeFill[id] === true;
        key.setAttribute("data-fill", on ? "on" : "off");
        const label = toolLabels.get(id) ?? id;          // "rect" / "ellipse"
        key.setAttribute("aria-label", on ? `${label} filled` : label);
        key.title = on ? `${label} filled (${hotkeys.get(id)})` : `${label} (${hotkeys.get(id)})`;
      }
```

(`aria-pressed` keeps meaning "is this the active tool" — unchanged.)

4. `src/main.ts`: `tools: TOOLS.map((t) => ({ id: t.id, hotkey: t.hotkey, label: t.label, fillable: t.fillable === true }))`,
   and `syncAll` passes `shapeFill: s.shapeFill` into `toolbar.sync`. No new subscriber is needed —
   `store.subscribe((s) => syncAll(s))` already fires on every `set`.

### 6.2 The LCD

`LcdState` gains `filled: boolean`; `sync` renders the tool field as
`toolEl.textContent = s.filled ? \`${s.tool} filled\` : s.tool;`. `main.ts` passes
`filled: s.shapeFill[s.tool] === true`.

`toolEl` is already a `<b>`, i.e. already the orange live-value treatment — so this adds a word to an
existing field rather than a new segment (the strip already carries eight). The word appears only in
the non-default state, which is exactly BRANDING's "orange marks state, never decoration". No new
LCD segment, no new geometry, no new color.

### 6.3 Tips

Toggle tips (deadpan, lowercase, no exclamation — BRANDING §7):
`"filled. click again for outline"` / `"outline. click again for filled"`. Plus the two tool-tip
edits in §5.4.

### 6.4 BRANDING.md

§6 says icons carry "no fills except tiny functional details". A wholly-filled glyph is a functional
state indicator, not decoration — and the reference demo's spray icon is already
`fill="currentColor"` throughout — but the rule as written doesn't cover it, and §11 requires the doc
and the implementation to agree in the same change. Add one clause to §6:

> …no fills except tiny functional details (spray dots, the fill-bucket drip) — or when the fill *is*
> the state being reported, as on a shape tool set to draw filled.

---

## 7. Files touched

| File | Change |
|---|---|
| `src/raster/raster.ts` | `rectFilled`; private `ellipseSamples` extracted from `ellipseOutline`; `ellipseFilled` |
| `src/tools/types.ts` | `ToolContext.filled`; `Tool.fillable?: true` |
| `src/tools/shape.ts` | optional `rasterFilled` argument; per-call raster selection; conditional `fillable` |
| `src/tools/rect.ts` | pass `rectFilled`; tip |
| `src/tools/ellipse.ts` | pass `ellipseFilled`; tip |
| `src/editor/grid-editor.ts` | `get filled()` on `toolCtx` |
| `src/state/store.ts` | `AppState.shapeFill` + doc comment |
| `src/main.ts` | init `shapeFill`; `toggleShapeFill`; `setTool` re-click branch; `e.repeat` guard; toolbar spec `fillable`; `syncAll` passes `shapeFill` / `filled` |
| `src/ui/toolbar.ts` | `fillable` in the spec; `data-fill` attribute; `sync` reflects it (attr + title + aria-label) |
| `src/ui/lcd.ts` | `LcdState.filled`; tool field suffix |
| `src/styles/app.css` | one `.tool[data-fill="on"] svg` rule |
| `BRANDING.md` | one clause in §6 |

Untouched on purpose: `state/persist.ts`, `state/history.ts`, `state/doc.ts`, `state/selection.ts`,
`preview/*`, `export/*`, `tools/line.ts`.

---

## 8. Acceptance criteria

Verify by hand in `npm run dev` (Chrome plus one of Firefox/Safari), after `npm run build` passes.

1. **Build clean.** `npm run build` (`tsc --noEmit && vite build`) reports zero errors under the
   strict config — including `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
2. **The toggle exists and is visible.** With pencil active, clicking the rect key selects rect and
   leaves it outline (hollow glyph). Clicking rect again: the glyph becomes solid orange on the
   charcoal cap, the LCD tool field reads `rect filled`, the tip reads
   `filled. click again for outline`. A third click returns to the hollow glyph and plain `rect`.
3. **Filled output.** With rect filled, dragging produces a solid rectangle in the current color;
   with rect outline, the same drag produces today's 1px outline.
4. **Live preview shows the fill.** During the drag (before release) the shape is already solid and
   tracks the pointer without smearing — each move restores the snapshot and re-rasterizes.
5. **One undo entry per shape.** After a filled drag, a single Ctrl/Cmd+Z restores the canvas to its
   exact pre-drag state; a single Ctrl/Cmd+Shift+Z brings the whole filled shape back.
6. **Per-tool independence.** Set rect filled, then select ellipse: the ellipse key is hollow and
   draws an outline. Toggle ellipse filled, then select rect: rect is still filled. The two keys
   never change together.
7. **Line is inert.** Clicking the line key twice (or pressing `l` twice) changes no icon, sets no
   fill state, and draws the same line; the line key never carries `data-fill`.
8. **Border mode clips silently.** In border mode, drag a filled rect that covers the locked center:
   the center cell stays transparent (hatch still visible), no error is thrown, the rest of the rect
   draws, and the exported PNG's center is fully transparent.
9. **Tile mode wraps.** In tile mode, drag a filled ellipse straddling a cell seam: all nine sections
   show the wrapped result simultaneously, the tile preview shows no seam, and the exported C×C tile
   tiles seamlessly.
10. **Focus mode still wraps.** In focused tile mode (`z`), drag a filled ellipse out into the
    one-cell raw margin: it wraps onto the cell exactly as the outline version does.
11. **Silhouettes agree.** Draw an outline ellipse over a given drag; undo; draw a filled ellipse
    over the identical drag. The filled shape's boundary covers every pixel the outline occupied —
    no notches, no pixels poking outside.
12. **Degenerate drags.** A click without moving, filled rect → exactly one pixel. A zero-height drag,
    filled ellipse → a straight line, same as outline.
13. **Hotkey parity, no strobe.** Pressing `r` when rect is already active toggles it; *holding* `r`
    down toggles it exactly once.
14. **The toggle is inert everywhere else.** Toggling fill with an otherwise-clean history leaves
    Ctrl/Cmd+Z reporting `nothing to undo`; it does not clear a marked selection, does not stamp a
    floating paste, does not change focus, does not regenerate previews, and does not trigger an
    autosave (nothing changed in `localStorage` afterwards).
15. **Brand audit.** No new colors or tokens; the filled icon is `currentColor` (ink on plastic at
    rest, orange on the active charcoal cap); LED behaviour unchanged; key still depresses; focus
    ring intact; all new copy lowercase, deadpan, no exclamation points; `BRANDING.md` §6 updated.

---

## 9. Implementation order (runnable at every step)

1. **Rasterizers.** Extract `ellipseSamples`, add `rectFilled` / `ellipseFilled`. Nothing calls them
   yet; the app behaves identically. Verify criterion 11's "before" half — an outline ellipse must
   look exactly as it did prior to the refactor. Commit.
2. **State.** `AppState.shapeFill` + init in `boot()`. Still no behaviour change. Commit.
3. **Tool plumbing.** `Tool.fillable`, `ToolContext.filled`, the `toolCtx` getter,
   `makeShapeTool`'s optional filled raster, rect/ellipse passing theirs. Drawing now consults a
   flag that nothing can flip; defaults are `false`, so output is unchanged. Commit.
4. **Interaction + indicators together.** The `setTool` re-click branch, `toggleShapeFill`, the
   `e.repeat` guard, tips, the toolbar `data-fill` / title / aria wiring, the CSS rule, the LCD
   suffix. Deliberately one commit: a toggle must never ship without its indicator. Commit.
5. **`BRANDING.md` §6 clause + the acceptance pass** in §8, both modes, both browsers. Commit.

---

## 10. Risks / notes for the implementer

- **`noUncheckedIndexedAccess`**: `lo[i]`, `hi[i]`, and `shapeFill[id]` are all
  `… | undefined`. Use local consts with `??` and `=== true` comparisons, not `!` assertions.
- **`exactOptionalPropertyTypes`**: never pass `fillable: undefined`; spread it conditionally, and
  keep the toolbar spec's `fillable` required-and-boolean.
- **`sync` is hot.** It runs on every store notification, including per-`pointermove` hover updates.
  Keep it to `setAttribute` / `textContent`; never `innerHTML` (it would also destroy the `.led`).
- **CSS over presentation attribute**: `.tool[data-fill="on"] svg { fill: currentColor; }` overriding
  `fill="none"` is standard (presentation attributes sit below author rules), but confirm visually in
  Firefox/Safari as well as Chrome.
- **LCD width**: `ellipse filled` is the longest tool value the strip has carried. The strip is
  `white-space: nowrap; overflow: hidden` with the tip column absorbing slack — check at a narrow
  window that the tip ellipsises rather than the readouts being clipped.
- **Do not "optimise" the fill by writing into the buffer.** The `plot` callback is what makes the
  locked center and the torus work; §4.1 is the load-bearing constraint of this task.
- **Shared worktree**: other agents may be committing here. If unfamiliar changes appear, check
  `git log` / `lattice list` before touching them.

# PM-11: default color palettes — Implementation Plan

> **Task (verbatim):** where "color" is there should be a palette selector with various color schemes, such as pastels, gem tones, rainbow, and monochrome

This plan is self-contained. Before starting, read `BRANDING.md` §3 (color) and §7 (voice) — the palettes defined here are brand material, and §3 gets edited as part of this task (see §7 below). Read `src/ui/chips.ts`, `src/ui/transport.ts` (the export-scale stepper is the control this one copies), and `src/main.ts` (wiring, tips, hotkeys).

**Do not invent a single hex value.** Every color this task ships is listed literally in §2. If a color looks wrong while implementing, stop and raise it — do not adjust it silently, these are brand values.

---

## 0. Fixed decisions (do not relitigate)

1. The existing 16 chips stay, verbatim, as one palette named **`shop`**, and it is the default. It is the brand's set (BRANDING.md §3, demo `CHIPS` array) — no reordering, no re-toning.
2. Five palettes total: `shop`, `mono`, `pastel`, `gem`, `rainbow`. Each is exactly 16 swatches (the grid is `repeat(8, 19px)` × 2 rows — see `.chips` in `app.css`; 16 keeps it a clean 8×2).
3. The selector is a **stepper** (`− <name> +`), matching the cell-size and export-scale steppers. Not a dropdown, not a row of named buttons. Justification in §4.
4. Changing the palette **never changes the current drawing color**, never touches the document, never pushes history, never regenerates previews.
5. The custom color well stays exactly as it is.
6. Palette selection **is persisted** with the project, as an additive optional field — no schema version bump, old files still load. Justification and the exact tolerant-decode rule in §3.

## 1. Scope

**Delivers:** a palette selector in the deck row, left of the chips, that switches the 16 chips among five named schemes; the palette rides along with the project (autosave + `pattern.json`); `[` / `]` step it; the LCD tip announces the change in brand voice; BRANDING.md §3 documents the palette system.

**Explicitly out of scope (do not build):**
- User-editable / user-saved palettes, palette import-export, per-chip editing.
- Recoloring existing artwork when the palette changes (a "remap to palette" feature is a different, much larger task).
- Making the custom-color `<input type="color">` open at the current color (it is hardcoded to `#FF4E00` today; leaving that alone keeps this diff about palettes — file it separately if it bothers you).
- Any new LCD field (see §6 — deliberate).
- Touching `demo/pattern-maker-demo.html`. The demo ships the `shop` set, which remains the default and remains unchanged, so the demo and the doc do not disagree (BRANDING.md §11 is satisfied).

## 2. The palette system

### 2.1 The slot contract

Every palette is 16 swatches in fixed roles. This is what makes switching safe — the same two chips are ink and paper in every scheme, so muscle memory survives a switch.

**Hard contract (all five palettes, no exceptions):**

| Slot | Role | Guarantee |
|---|---|---|
| 0 | **ink** | The palette's usable near-black. Always drawable as "dark". |
| 1–3 | spine | Three ascending mid values, tinted to the palette's temperature. |
| 4 | **paper** | `#FBFAF8` — the brand's `--paper` token, identical in every palette. |

Slots 0–4 are the **value spine**: dark → light. Slot 0 and slot 4 are the "you can always draw" guarantee the task requires.

**Why paper is fixed and ink is not:** you print onto one stock; the inks change. The substrate is a constant of the instrument (it is literally the `--paper` token the canvas well is built from), so slot 4 is `#FBFAF8` everywhere. Ink is a pigment, so its temperature moves with the scheme — pastel's ink leans violet, gem's leans blue-black, shop and mono use the brand's warm `#232320`.

**Soft contract (slots 5–15, the eleven colors):** four of the five palettes follow the `shop` set's own ordering — 5 = wash (the palette's tinted light stock), 6 = earth (its deep neutral-chromatic), 7 = accent (its loudest single color), 8–15 = the hue wheel in fixed order red, yellow, green, teal, blue, violet, magenta, pink. `rainbow` deliberately spends all eleven slots on one continuous hue sweep instead; that is the only palette that departs, and it departs on purpose.

This structure is not invented for this task — it is the `shop` array read back honestly (5 neutrals, then cream / brown / orange / eight hues), which is also how BRANDING.md §3 already describes it.

### 2.2 The palettes

All five, in stepper order (quiet → loud). Arrays are given in slot order 0→15, which is left-to-right, top row then bottom row in the chip grid.

---

**`shop` — the house set. Unchanged. Restrained industrial, screen-print flavored.**

```
#232320 #575651 #8B8A85 #C6C5BF #FBFAF8 #EFE6D0 #8A5A3B #FF4E00
#D22E2E #F2B500 #3E9B4F #2E8B8B #2E5FD2 #7B4FD2 #C43E8F #F2A0B8
```

Copy this from the current `CHIPS` constant — byte for byte, do not retype it.

---

**`mono` — a true value ramp, warm-biased. No hue anywhere.**

```
#232320 #575651 #8B8A85 #C6C5BF #FBFAF8 #2E2D29 #3C3B36 #4A4944
#626159 #767570 #9C9B95 #ADACA6 #BDBCB6 #D3D2CC #E0DFD9 #EDEBE5
```

Slots 0–4 are the brand's own gray family (the spine, coarse steps). Slots 5–15 are eleven finer values running dark → light, interleaving the spine, so the second row reads as a continuous ramp and the whole grid covers sixteen steps.

**Warm, not neutral — justified:** every gray in this brand is warm-biased (`--ink #232320`, `--label #8B8A85`, `--ground #D3D2CD`, `--plastic #E7E6E1`), and BRANDING.md §10 explicitly forbids "pure `#808080` / `#FFFFFF` chrome". A neutral ramp would read cold against the plastic body and would be the one place in the product where the grays disagree. Every value above holds R > G > B by a few points. It is also true to the metaphor: black ink on warm stock is a warm ramp.

Note the fine steps are close together (e.g. `#BDBCB6` → `#C6C5BF` → `#D3D2CC`). That is deliberate and it is what monochrome is for — value control at fine intervals. Do not "fix" it by spreading them.

---

**`pastel` — chalky, high-value, low chroma. Sugar paper and soft pigment.**

```
#3B3742 #6F6A78 #A9A2AE #D8D3DC #FBFAF8 #F7E9E0 #C39B87 #F0907A
#F0A3A0 #F2DFA0 #B3D6A8 #A3D2CE #A8BEE0 #C0B2E0 #E0AFD1 #F5C6D3
```

Spine tinted lilac so it belongs to the same family as the hues. Ink is a soft violet-charcoal, not black — a pastel scheme with a hard black in it stops being a pastel scheme, but it still has to be dark enough to draw with (it is, comfortably). Slot 5 is a blush wash, slot 6 a dusty clay, slot 7 a coral that is the loudest thing in the set without leaving the family. Hue wheel is uniformly chalky: rosewater, butter, mint, seafoam, powder, wisteria, orchid, shell.

---

**`gem` — deep and expensive. Cut-stone saturation, cool spine.**

```
#14161A #2B3038 #4A525E #9AA2AC #FBFAF8 #E7E9ED #7E5F2E #C4711A
#8E1F32 #C99A21 #1D6E4E #17696E #1E3F8F #5B2E8F #961C63 #C4708C
```

Obsidian ink, a slate spine (polished stone, cool), pearl wash at 5, bronze at 6, topaz accent at 7. The hue wheel is the stones: garnet, citrine, emerald, tourmaline, sapphire, amethyst, rhodolite, rose quartz. Dark and rich but still under the "nothing neon" rule — these are deep-and-slightly-dirty, not fluorescent.

---

**`rainbow` — one ordered hue sweep, eleven steps, screen-print flavored.**

```
#232320 #575651 #8B8A85 #C6C5BF #FBFAF8 #C9332F #D9701C #D8AE14
#86A32B #3B9457 #1E9083 #2081A5 #2B5CB8 #5A46B5 #8C41A8 #C0417E
```

Neutral brand spine (slots 0–4) so the sweep reads clean against it, then eleven hues spaced roughly evenly around the wheel — vermilion, orange, gold, leaf, green, sea, cyan-blue, blue, indigo, violet, rose. All held at a similar mid value and a moderate chroma: this is a printed spectrum chart, not an RGB primary set. If any of these ever reads as neon on screen, that is a bug in the value, not a licence to brighten the rest.

### 2.3 Names

Lowercase, one word, per BRANDING.md §4 ("labels are lowercase", one word where possible): `shop`, `mono`, `pastel`, `gem`, `rainbow`. `shop` is the print shop / machine shop — the house inks. Singular `pastel` and `gem` read as instrument labels; the plural forms in the task description are the human's prose, not the label.

## 3. State model

### 3.1 Store

Add one field to `AppState` in `src/state/store.ts`:

```ts
/** Which chip set the deck shows. Cosmetic to the document — switching it
 *  never touches pixels, history, or previews — but it belongs to the
 *  project and is persisted with it. */
palette: PaletteId;
```

`PaletteId = "shop" | "mono" | "pastel" | "gem" | "rainbow"`.

### 3.2 Where the data lives

New file **`src/state/palettes.ts`** — pure data, no DOM (keeps the Tauri seam from PM-3 §10 intact, and lets `persist.ts` validate an id without importing from `ui/`):

```ts
export type PaletteId = "shop" | "mono" | "pastel" | "gem" | "rainbow";
export interface Palette {
  readonly id: PaletteId;
  readonly label: string;      // what the readout shows
  readonly tip: string;        // LCD line on switch (§6)
  readonly swatches: readonly string[];  // 16, slot order
}
export const PALETTES: readonly Palette[];      // stepper order: shop, mono, pastel, gem, rainbow
export const DEFAULT_PALETTE: PaletteId = "shop";
export function isPaletteId(v: unknown): v is PaletteId;
export function paletteById(id: PaletteId): Palette;   // total — falls back to shop
```

`src/ui/chips.ts` keeps exporting `CHIPS` **only if something else imports it** (check: currently nothing does) — otherwise delete the constant from `chips.ts` and let the `shop` entry in `palettes.ts` be its only home, with the comment "part of the brand — BRANDING.md §3, demo CHIPS array verbatim" moved along with it.

`ui/` modules today import nothing from `state/` — they are dumb views synced from `main.ts`. **Keep it that way:** `chips.ts` must not import `palettes.ts`. It receives swatches and a label through its sync call.

### 3.3 Persistence — persist it (additively)

**Recommendation: persist.** The palette is the tray of inks you had out when you left. `colorHex` — which likewise puts not one pixel in the document — is already persisted for exactly that reason, and the palette is the same kind of fact about the work. The session-only precedents cut the other way on inspection: `focus` is a viewport position and `exportScale` is an output preference; neither is a property of the artwork, and both would be actively wrong to restore. A project reopened in `shop` when you drew it in `gem` is a small, avoidable betrayal.

**Cost, honestly:** it touches `persist.ts`, which prior plans have left alone. The change is additive and does not bump `version`:

- `ProjectV1` gains `palette: PaletteId` (required on **write** — every file this build produces has it).
- `encodeProject(doc, mode, colorHex, palette)` — one more parameter. Same for `autosave(...)` and `downloadProject(...)`.
- `DecodedProject` gains `palette: PaletteId`.
- `decodeProject` reads it **tolerantly**: `const palette = isPaletteId(p["palette"]) ? p["palette"] : DEFAULT_PALETTE;`. Absent, unknown, or malformed → `shop`, and **decode never fails on this field.** A corrupt or foreign palette value must never reject an otherwise valid drawing. This is what keeps every existing autosave and every `pattern.json` already on disk loadable, and is why no version bump is warranted.

**Rejected alternative:** session-only (zero schema change, `palette` initialised to `shop` on every boot). Cheaper by ~10 lines, but reloading the page silently changes the instrument's setup under a project that is otherwise restored exactly — the app already restores mode, cell size, both buffers and the current color, so palette is the one thing that would snap back, and it would read as a bug.

### 3.4 The mutation

In `main.ts`, next to `stepScale` (copy its comment discipline — it exists for precisely this class of change):

```ts
/** Move through PALETTES, wrapping. Plain store.set on purpose: the palette
 *  changes neither the document nor the previews, so it must bump neither
 *  dirtyDoc nor dirtyPreview — no preview regeneration, no history entry.
 *  It IS persisted, so the autosave subscriber watches s.palette. */
function stepPalette(delta: number): void { … }
```

- Index math wraps: `j = (i + delta + n) % n` (guard `delta` sign — `((i + delta) % n + n) % n`).
- Under `noUncheckedIndexedAccess`, index reads are `T | undefined` — use `PALETTES[j] ?? PALETTES[0]` style fallbacks, as `EXPORT_SCALES[j] ?? 1` already does.
- Sets `{ palette: next.id, tip: next.tip }`.

**Wrap, not clamp — justified:** the cell and scale steppers clamp because size has ends ("that's as big as cells get"). A palette set has no magnitude and therefore no ends; it is a rotary selector, not a fader. Wrapping means `−` from `shop` lands on `rainbow` rather than doing nothing. **Do not copy the at-limit tip pattern here** — there is no limit to report.

**Autosave trigger:** `main.ts` has a `store.subscribe` that calls `debouncedAutosave()` when `dirtyDoc` / `dirtyPreview` / `mode` / `colorHex` change. Add `|| s.palette !== prev.palette`. Without this the palette only reaches storage when something else happens to change, which is a real and easy-to-miss bug.

### 3.5 Boot and load

- `boot()`: `palette: restored ? restored.palette : DEFAULT_PALETTE`.
- `applyProject(p)`: include `palette: p.palette` in the `bumpDoc` patch, alongside `mode` / `colorHex`.
- `doSave()` / `autosave(...)` calls: pass `s.palette`.

## 4. UI specification

### 4.1 Form: a stepper — chosen

```
color  (◯ current)  [ − ][ rainbow ][ + ]  ● ● ● ● ● ● ● ●   (◯ custom)      … transport →
                                            ● ● ● ● ● ● ● ●
```

**Why a stepper over the alternatives:**

- It is the deck's existing vocabulary. PM–1 already says "a small set of values, two keys and a charcoal readout" twice (`cell · − 016 +`, `− 1× +  scale`). A third instance costs the user nothing to learn; a dropdown would be the only native OS widget in a device that has deliberately avoided them (BRANDING.md §1: "the interface vocabulary comes from synthesizers and field recorders, not from desktop operating systems").
- **Width.** Five named buttons at ~52px each is ~300px of deck. The stepper is ~140px (26 + 78 + 26 + two 6px gaps). The deck currently runs ~325px on the left (label + well + 194px chip grid + custom + gaps) and ~520px on the right (transport, `margin-left: auto`), inside a device up to 1400px wide — so a row of buttons *would* fit at desktop width, but it would spend a fifth of the row on a control used a handful of times per session, and it would break first when the row wraps. The stepper is the cheapest thing that reads correctly.
- The readout is a **word**, which is self-describing in a way `016` and `1×` are not — so, unlike the other two steppers, it needs no `pal` label of its own. The row already says `color`.

### 4.2 Placement

Between the current-color well and the chip grid:

`color` → current well → **palette stepper** → 16 chips → custom well

The stepper visually gates the chips it governs (reading order: what you're drawing with, which set, the set, the escape hatch), and the custom well stays welded to the right edge of the chips exactly where it is today.

### 4.3 Markup and CSS

Build it in `src/ui/chips.ts` with the existing `h()` helper, reusing `.stepper` / `.key` / `.readout` — copy `transport.ts`'s export-scale block, which is the closer precedent (fixed value set → the readout is an **inert `<span>`, not a click-to-type button**).

```
<div class="stepper pal-stepper" role="group" aria-label="palette">
  <button class="key" aria-label="previous palette" title="previous palette ([)">−</button>
  <span class="readout" aria-live="polite" aria-label="palette">shop</span>
  <button class="key" aria-label="next palette" title="next palette (])">+</button>
</div>
```

One new CSS block in `app.css`, in the `/* ── lower deck ── */` section, right after the `.current` rule:

```css
/* palette selector: the cell stepper's parts, sized to the deck row */
.pal-stepper .key { width: 26px; height: 26px; }
.pal-stepper .readout {
  width: 78px;               /* fits "rainbow"; fixed so the row never jitters */
  padding: 6px 8px;
  font-variant-numeric: normal;   /* it's a word, not a readout of figures */
  text-align: center;
}
```

26px key height matches `.current` (26px) exactly, so the three deck elements sit on one optical line with the 19px chips. The fixed 78px width is a brand requirement, not a nicety — BRANDING.md §4: "instrument readouts don't jitter". Add nothing else: no border, no orange, no hover flourish. The readout is charcoal-on-charcoal information surface, same as its two siblings.

### 4.4 Re-rendering the chips

`createChips` currently closes over `hex` per button and keys a `Map<hex, button>`. Rework:

- Keep a mutable `let swatches: readonly string[]` and an ordered `buttons: HTMLButtonElement[]`.
- Each button's click handler reads by **index** — `() => { const hex = swatches[i]; if (hex) onColor(hex); }` — not by a captured hex.
- `render(next)` reconciles: append/remove buttons until `buttons.length === next.length`, then for each set `style.background`, `title = hex.toLowerCase()`, `aria-label = "color " + hex`. **Reuse the existing elements — never rebuild the grid.** If a chip has keyboard focus when the user presses `]`, rebuilding would drop focus to `<body>` and strand the keyboard user mid-row.
- Pressed state stays computed from the current color, by hex identity (§4.5).

Signature after the change (view stays dumb — no `state/` import):

```ts
export interface ChipsSpec {
  onColor(hex: string): void;
  onPaletteStep(delta: number): void;
}
export interface ChipsView {
  root: HTMLElement;
  sync(s: { colorHex: string; swatches: readonly string[]; paletteLabel: string }): void;
}
export function createChips(spec: ChipsSpec): ChipsView;
```

`main.ts` `syncAll`: `chips.sync({ colorHex: s.colorHex, swatches: p.swatches, paletteLabel: p.label })` where `p = paletteById(s.palette)`. `main.ts` already calls `syncAll(store.get())` at boot, so the chips can be built colorless and painted by the first sync.

### 4.5 The current color, and the pressed ring

**The current drawing color is untouched by a palette change.** It is already committed — it is in the current well, it is what the next stroke will use, and it may well have come from the eyedropper or the custom well and never have been in *any* palette. Silently repainting the user's ink because they browsed the chip sets would be destructive and would make browsing dangerous.

**The ring follows from that, deterministically:** `sync` sets `aria-pressed="true"` on any chip whose hex equals the current color, exactly as today. After a palette change the same rule is re-evaluated against the new swatches, so:

- The ring **survives** when the new palette contains the current color — which is guaranteed for `#FBFAF8` (paper, in all five) and true for `#232320` across `shop` / `mono` / `rainbow`.
- The ring **disappears** when it does not. No chip is pressed, and that is correct: the ring means "this chip is the current color", and if none is, none should claim to be.

It is not cleared as a separate deliberate act, and it is not sticky by index. Nothing extra to implement — but it must be verified (acceptance criterion 5), because "ring survives on a coincidental hex match" is the behavior a reviewer would otherwise flag as a bug.

### 4.6 The custom well

Stays, unchanged, in its current position at the right of the chips. It is what keeps a palette a starting point instead of a cage — any of the five can be departed from at any time, which is the precondition for shipping opinionated palettes at all. Its conic-gradient ring is one of the two lighting exceptions BRANDING.md §3 explicitly grants, so it does not re-tint per palette; it stays the fixed spectrum well. It does not add colors to the palette and the palette does not constrain it.

### 4.7 Keyboard

**`[` = previous palette, `]` = next palette.**

Free-key check against `main.ts`'s handler: ctrl/meta combos (`z y c x v`), `escape`, `enter`, arrows, `delete`/`backspace`, `z` (focus), `1`/`2` (modes), then tool hotkeys `p e l r o f i m`. Brackets are untouched, and the handler already early-returns when focus is in an `INPUT`/`TEXTAREA`, so the cell-size type-in field is safe.

**Why brackets:** they are the near-universal "step through a set" binding in drawing software, they map one-to-one onto the stepper's two keys, and — the practical reason — they do not consume a letter that the roadmap still wants (`b` brush, `s` spray/symmetry are named as future work in PM-3 §1). Handle `[` and `]` only; do not also accept `{` / `}`, since shift is already spoken for as the ±8 modifier elsewhere in the deck. `e.key.toLowerCase()` leaves brackets unchanged, so they can slot in beside the `z` / `1` / `2` checks, before the `toolByHotkey` fallthrough.

## 5. Per-file changes

| File | Change |
|---|---|
| `src/state/palettes.ts` | **New.** `PaletteId`, `Palette`, `PALETTES` (the five arrays from §2, in stepper order), `DEFAULT_PALETTE`, `isPaletteId`, `paletteById`. Pure data + two functions, no DOM. |
| `src/state/store.ts` | Add `palette: PaletteId` to `AppState`, with the comment from §3.1. Import the type. |
| `src/state/persist.ts` | `ProjectV1.palette: PaletteId`; `encodeProject` / `autosave` / `downloadProject` take a `palette` argument; `DecodedProject.palette`; tolerant decode per §3.3. |
| `src/ui/chips.ts` | Add the stepper; index-based chip handlers; `render(swatches)` reconciliation; new `ChipsSpec` / `sync` shape (§4.4). Move or delete the `CHIPS` constant (§3.2). |
| `src/main.ts` | `stepPalette`; wire `onPaletteStep`; `[` / `]` hotkeys; boot + `applyProject` + `doSave` + autosave-call palette plumbing; add `s.palette !== prev.palette` to the autosave subscriber; `syncAll` passes swatches + label. |
| `src/styles/app.css` | One `.pal-stepper` block in the lower-deck section (§4.3). |
| `BRANDING.md` | §3 "The drawing palette" → "The drawing palettes" (§7 below). |

`lcd.ts`, `toolbar.ts`, `transport.ts`, `doc.ts`, `history.ts`, `tools/`, `raster/`, `preview/`, `export/`, `editor/` are **not** touched.

## 6. LCD feedback and voice

No new LCD field. The strip already carries seven fields plus the tip and is `overflow: hidden`; the palette name is permanently visible in the deck readout two rows above, so an eighth field would buy redundancy at the cost of the one thing the LCD must not become, which is crowded. The tip line carries the event; the deck carries the state.

Tips (one per palette, fired on every switch — deadpan, lowercase, no exclamation, no emoji, per §7):

| Palette | Tip |
|---|---|
| `shop` | `shop inks. the house set` |
| `mono` | `mono. value does the work` |
| `pastel` | `pastel. quiet on purpose` |
| `gem` | `gem tones. deep and expensive` |
| `rainbow` | `rainbow. eleven inks, one sweep` |

Store them as the `tip` field on each `Palette` so the copy lives next to the colors it describes.

## 7. BRANDING.md edit

Replace the §3 subsection **"The drawing palette"** (currently one paragraph naming the 16 chips) with **"The drawing palettes"**, containing:

1. One sentence of principle, carried over: slightly muted, screen-print flavored, nothing neon; user artwork may be loud, the chips that make it should still look considered.
2. **The slot contract** from §2.1 — 16 swatches; slots 0–4 are the value spine; slot 0 is the palette's ink; **slot 4 is `#FBFAF8` in every palette** ("you print onto one stock; the inks change"); slots 5–15 are the eleven colors, following the `shop` set's wash / earth / accent / hue-wheel order except in `rainbow`.
3. **The five palettes**, each as a name, a one-line character description, and its 16 hex values in slot order (copy the blocks from §2.2 verbatim — the doc is the source of truth for these values from then on).
4. A line stating that `shop` is the default and is the original brand set, unchanged, and that the demo ships `shop` (so §11's "when this document and the demo disagree" clause is not triggered).
5. A line stating that the custom well is unaffected by palette choice.

Keep §3's existing table structure and tone; do not restructure the rest of §3, and do not touch §1, §5, §7, or §10.

## 8. Acceptance criteria

Verify by hand in `npm run dev`, plus `npm run build` (which runs `tsc --noEmit` under the strict config).

1. `npm run build` passes with zero TypeScript errors. No new runtime dependencies.
2. The deck row reads `color  (well)  [− shop +]  (16 chips)  (custom)`; the stepper's keys depress on click, the readout is charcoal with lowercase mono text, and the row's geometry does not shift when the name changes from `gem` (3 chars) to `rainbow` (7).
3. Stepping through all five palettes re-renders **all 16 chips** each time, in slot order, with the exact hex values from §2.2 (spot-check at least slot 0, slot 4 and slot 15 of two palettes against the plan with a color picker or DevTools).
4. **Every palette contains a usable ink and paper tone:** in each of the five, chip 1 (slot 0) draws a near-black mark and chip 5 (slot 4) draws `#FBFAF8`; confirm slot 4 is byte-identical across all five.
5. **Switching palettes leaves the current drawing color unchanged** — the current well does not change color, and the next stroke draws in the same color as the last one. Specifically: pick `#F2A0B8` (shop, slot 15), switch to `gem`, draw — the stroke is still `#F2A0B8`.
6. **Pressed ring:** with `#FBFAF8` selected, switching palettes keeps the orange ring on chip 5 in all five (the hex exists everywhere). With `#F2B500` selected (shop only), switching to `pastel` leaves **no** chip ringed while the current well still shows `#F2B500`; switching back to `shop` restores the ring on that chip.
7. Stepping **wraps**: `−` from `shop` lands on `rainbow`; `+` from `rainbow` lands on `shop`. No "at the limit" tip ever appears.
8. `[` and `]` step the palette; they do nothing while the cell-size field is being typed in; they do not steal any existing shortcut (verify `p e l r o f i m z 1 2`, ctrl+z/y/c/x/v still behave).
9. Each switch prints its palette's tip on the LCD, and the LCD gains no new field.
10. A palette change alone does **not** regenerate previews, does not create an undo entry (press ctrl+z after switching — it undoes the last *drawing* action, not the switch), and does not alter a single pixel.
11. **Persistence:** select `gem`, draw, reload the page — the app comes back in `gem` with the drawing intact. Save `pattern.json`, clear localStorage, load the file — `gem` comes back with it.
12. **Backward compatibility:** a `pattern.json` produced before this change (no `palette` key) still loads, with no error, opening in `shop`. Same for a file whose `palette` value is garbage (`"palette": "hotdog"` or `"palette": 7`) — it loads in `shop`, it does **not** get rejected.
13. Keyboard/a11y: the stepper's two keys are tab-reachable with the orange focus ring; the readout announces via `aria-live`; a chip that has keyboard focus **still has it** after a `]` press (this is the test that catches a rebuild-instead-of-reuse implementation).
14. Brand audit: no new colors outside the plan, no orange anywhere on the stepper except the focus ring, all labels lowercase mono, tips deadpan and punctuation-light.
15. BRANDING.md §3 documents all five palettes with their hex values and the slot contract; the values in the doc and in `src/state/palettes.ts` match exactly.

## 9. Implementation order

Each step leaves the app runnable; commit per step.

1. **Data.** Add `src/state/palettes.ts` with all five palettes and the helpers; move the `CHIPS` comment/values into the `shop` entry. Wire nothing yet. `npm run build` passes. *(App unchanged.)*
2. **State + view plumbing, one palette.** Add `palette` to `AppState` (defaulting to `shop`), change `createChips` to the new spec/`sync` shape and drive the existing 16 chips through `render(swatches)` from `paletteById(s.palette)`. **No selector UI yet.** The app looks and behaves exactly as before — this step is the refactor, isolated, so a regression here is unambiguous.
3. **The selector.** Stepper markup in `chips.ts`, `.pal-stepper` CSS, `stepPalette` in `main.ts`, tips. Palette switching now works end to end, session-only.
4. **Hotkeys.** `[` / `]`.
5. **Persistence.** `persist.ts` signature + tolerant decode, boot / `applyProject` / `doSave` plumbing, autosave subscriber condition. Verify criteria 11 and 12 — including hand-editing a saved `pattern.json` to remove the key and to corrupt it.
6. **BRANDING.md §3.** The doc edit, matched against the shipped values.
7. **Audit pass.** Walk criteria 1–15.

## 10. Risks and notes for the implementer

- **The autosave subscriber is the easy miss.** `main.ts` has two `store.subscribe` blocks with explicit change lists; the palette must be added to the *autosave* one and to **neither** the preview one nor anything that bumps `dirtyDoc`/`dirtyPreview`. Getting this wrong shows up as either "palette never persists" or "switching palettes churns previews and the autosave".
- **`noUncheckedIndexedAccess: true`** — every `PALETTES[i]` and `swatches[i]` read is `T | undefined`. Follow the existing `?? fallback` idiom rather than non-null assertions.
- **`exactOptionalPropertyTypes: true`** — declare `ProjectV1.palette` as **required** (writes always include it) and handle absence only in `decodeProject`, which reads through `Record<string, unknown>` anyway. Do not model it as `palette?: PaletteId`; that fights the flag for no benefit.
- **Reuse the chip elements, don't rebuild the grid** (§4.4) — this is both the focus-preservation fix and the reason the click handlers must be index-based. A handler that captured `hex` at construction time will keep painting the *old* palette's color after a switch; that is the single most likely bug in this task.
- **Do not let `ui/` import `state/`.** `chips.ts` gets swatches and a label through `sync`. Breaking this makes `ui/` untestable in isolation and inverts the layering the rest of the app follows.
- **Decode must stay total for this field.** `decodeProject` returns `null` on *any* other validation failure; the palette is the one field where the correct response to garbage is a default, not a rejection. A drawing must never be lost because of a cosmetic string.
- **The hex values are brand values.** They are listed in §2.2 and go into BRANDING.md in step 6. If one genuinely reads wrong on screen, raise it and change it in both places in the same commit (BRANDING.md §11's rule, applied to the doc and the source).

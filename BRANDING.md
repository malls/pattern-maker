# pattern maker — Brand Guide

**Product name:** pattern maker
**Model designation:** PM–1
**One-liner:** Photoshop, if teenage engineering made it. A professional drawing instrument that happens to run in software.

---

## 1. Brand essence

**The app is a device.** pattern maker doesn't present as a window full of menus — it presents as a piece of hardware: a matte plastic instrument panel with key caps, LEDs, a dark display, and exactly one loud color. The interface vocabulary comes from synthesizers and field recorders, not from desktop operating systems. Pro capability, toy-grade delight, industrial restraint.

Three words to check every decision against: **Precise. Tactile. Quiet.**

- *Precise* — everything sits on a grid; labels are small, monospaced, and exact; readouts use tabular figures and zero-padded coordinates.
- *Tactile* — controls are physical metaphors that actually behave physically: keys depress, LEDs light, chips are round because chips are round.
- *Quiet* — the surface is calm grays so the user's artwork is the loudest thing on screen. The brand speaks in one accent color, used sparingly and confidently.

The restraint is the point. When everything is gray, one orange dot is a siren.

## 2. Name, wordmark & model number

- The product is **pattern maker**, always lowercase, set in the grotesk (see §4). Never "PatternMaker", never title case.
- The model number is **PM–1** — uppercase, en dash (never a hyphen: `PM–1`, not `PM-1`), set in the mono face, presented as a charcoal badge chip. Hardware gets model numbers; this is hardware.
- Lockup: `pattern maker` + PM–1 badge, baseline-aligned, wordmark first.
- The descriptor line is `professional pattern instrument` — lowercase mono, label gray.
- Version flourishes ("’96", splash art, etc.) from the previous identity are retired.

## 3. Color

Warm-biased grays for the body, charcoal for anything that displays information, and a single accent. There is no secondary accent. There will be no secondary accent.

### Body (the hardware)

| Token | Hex | Use |
|---|---|---|
| `--ground` | `#D3D2CD` | Page behind the device, with a faint 22px dot grid (`rgba(35,35,32,.13)`) |
| `--plastic` | `#E7E6E1` | Device body |
| `--key` | `#F2F1EC` | Key caps |
| `--key-border` | `#C6C5BF` | Key edges, hairlines |
| `--key-shadow` | `#B4B3AD` | The hard 2px key drop shadow |
| `--ink` | `#232320` | Text, icons (warm near-black) |
| `--label` | `#8B8A85` | Secondary labels, section markers |
| `--paper` | `#FBFAF8` | Canvas / document surface |

### Display & accent

| Token | Hex | Use |
|---|---|---|
| `--charcoal` | `#1B1B1A` | LCD strip, active tool keys, badge |
| `--lcd-text` | `#E8E6DF` | Light text on charcoal |
| `--orange` | `#FF4E00` | **The accent.** LEDs, active states, primary action, focus rings, live values |

**Rules of engagement**

- Orange marks *state and action*, never decoration: a lit LED, an active toggle, the export key, the current value on the LCD, a focus ring. If orange appears somewhere nothing is happening, remove it.
- Charcoal surfaces are where information lives (readouts, active keys). Plastic surfaces are where hands go. Keep the two roles distinct — the canvas sits in a light well, not on charcoal.
- No gradients on any surface. The only permitted "lighting" is the device's inset top highlight, the key drop shadow, and the LED glow (`0 0 5px rgba(255,78,0,.9)`). Two functional exceptions: the corner screws' machined shading and the custom-color well's spectrum ring — both tiny, both earn it.
- Text is ink-on-plastic or lcd-text-on-charcoal. Never set text in orange except single live values on the LCD.

### The drawing palettes

The in-canvas color chips are part of the brand — slightly muted and screen-print flavored by default. User artwork may be loud; the chips that make it should still look considered. There are six sets, stepped from the deck, and every one of them obeys the same slot contract.

**Where "nothing neon" applies.** The house set (`shop`) and everything in the chrome — body, keys, LCD, the accent — stay muted and screen-print flavored. That rule is absolute there and is not up for negotiation. A *named* palette may depart from it where its own name demands the departure: `rainbow` is the exact CSS color keywords, and `neon` is built to glow. The licence is per-palette, granted by the name, and never extends to the chrome or the accent. It is not a licence to brighten the other four.

**The slot contract.** Each palette is exactly 16 swatches in fixed roles, which is what makes switching sets safe — the same two chips are ink and paper in every scheme, so muscle memory survives.

| Slot | Role | Guarantee |
|---|---|---|
| 0 | ink | The palette's usable near-black. Always drawable as "dark". |
| 1–3 | spine | Three ascending mid values, tinted to the palette's temperature. |
| 4 | paper | `#FBFAF8` — the `--paper` token, **identical in every palette**. |
| 5–15 | the colors | Wash, earth, accent, then the hue wheel: red, yellow, green, teal, blue, violet, magenta, pink. |

Slots 0–4 are the value spine, dark to light. Paper is fixed and ink is not because you print onto one stock and the inks change: the substrate is a constant of the instrument, the pigment moves with the scheme. Slot 4 is `#FBFAF8` in all six sets, `neon` included — the ground goes dark by using slot 0, not by moving the stock.

Two carve-outs from the soft part of the contract. `rainbow` and `neon` spend all eleven color slots on a single hue sweep rather than wash/earth/accent/wheel, on purpose. And `neon` is the one palette whose spine is cool rather than warm-biased — a blue-violet near-black, because neon hues over the house's warm putty grays read muddy.

**The six sets**, in stepper order, quiet to loud. Values in slot order; these are brand values and this table is the source of truth for them (`src/state/palettes.ts` matches it exactly).

**`shop`** — the house set. Restrained industrial, screen-print flavored.

```
#232320 #575651 #8B8A85 #C6C5BF #FBFAF8 #EFE6D0 #8A5A3B #FF4E00
#D22E2E #F2B500 #3E9B4F #2E8B8B #2E5FD2 #7B4FD2 #C43E8F #F2A0B8
```

**`mono`** — a true value ramp, warm-biased. No hue anywhere. Every gray in this brand holds R > G > B; a neutral ramp would read cold against the plastic and would be the one place the grays disagree. The fine steps sit close together deliberately — that is what monochrome is for.

```
#232320 #575651 #8B8A85 #C6C5BF #FBFAF8 #2E2D29 #3C3B36 #4A4944
#626159 #767570 #9C9B95 #ADACA6 #BDBCB6 #D3D2CC #E0DFD9 #EDEBE5
```

**`pastel`** — chalky, high-value, low chroma. Sugar paper and soft pigment. The spine is tinted lilac and the ink is a violet-charcoal rather than a black — a pastel set with a hard black in it stops being one, but it is still dark enough to draw with.

```
#3B3742 #6F6A78 #A9A2AE #D8D3DC #FBFAF8 #F7E9E0 #C39B87 #F0907A
#F0A3A0 #F2DFA0 #B3D6A8 #A3D2CE #A8BEE0 #C0B2E0 #E0AFD1 #F5C6D3
```

**`gem`** — deep and expensive. Obsidian ink, a cool slate spine, pearl wash, bronze, topaz, then the stones: garnet, citrine, emerald, tourmaline, sapphire, amethyst, rhodolite, rose quartz. Rich but still deep-and-slightly-dirty, never fluorescent.

```
#14161A #2B3038 #4A525E #9AA2AC #FBFAF8 #E7E9ED #7E5F2E #C4711A
#8E1F32 #C99A21 #1D6E4E #17696E #1E3F8F #5B2E8F #961C63 #C4708C
```

**`rainbow`** — the CSS color keywords, straight. Every swatch is a real named color, spelled exactly: the spine is black, dimgray, gray, silver; then eleven hue keywords in one ordered sweep — red, orangered, orange, gold, yellow, lime, green, cyan, blue, indigo, magenta. These are not screen-print interpretations and must not be retuned toward the house values; a near-value would make the name a lie. Slot 4 is still `#FBFAF8`, not CSS `white`, because paper is paper.

One consequence, accepted rather than overlooked: `orangered` (`#FF4500`) is all but identical to the accent (`#FF4E00`) — the same color to the eye at chip size. The accent keeps its meaning anyway, because orange means something by *where* it appears — a lit LED, an active key, a focus ring — not by being a hex nothing else is allowed to hold. The one cost is that when that chip is the current color, its orange ring reads as a halo rather than as a ring, and `red` and `orangered` sitting side by side read as two reds. Both are the price of spelling the keywords exactly, and the keywords win.

```
#000000 #696969 #808080 #C0C0C0 #FBFAF8 #FF0000 #FF4500 #FFA500
#FFD700 #FFFF00 #00FF00 #008000 #00FFFF #0000FF #4B0082 #FF00FF
```

**`neon`** — loud on a dark ground, and the only set with a cool spine: a blue-violet near-black rising to dusk, because these hues over warm putty grays read muddy. Eleven fluorescents in the same ordered sweep as `rainbow` — rose, orange, yellow, acid, green, mint, cyan, azure, blue, purple, magenta. This one is meant to glow; that is the whole brief, and it stops at the canvas.

```
#0B0B12 #1E1B2E #4A4468 #8F86B8 #FBFAF8 #FF1D58 #FF6B00 #FFD400
#C6FF00 #39FF14 #00FFC6 #00E5FF #00A3FF #4D5BFF #B026FF #FF00E5
```

`shop` is the default and is the original brand set, unchanged; it is also the set the demo ships. The custom-color well is unaffected by palette choice — it keeps its fixed spectrum ring and stays available in all six, which is what makes a palette a starting point rather than a cage.

## 4. Typography

System faces only — no webfonts, no load cost, no fallback surprises. Two roles, strictly separated:

| Role | Stack | Treatment |
|---|---|---|
| Wordmark / product voice | `"Helvetica Neue", Helvetica, Arial, sans-serif` | Medium weight, lowercase, slightly tight (`-.01em`) |
| Everything else | `ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace` | Labels 9px, `.09em` tracking, lowercase; readouts 11px with `font-variant-numeric: tabular-nums` |

- **Labels are lowercase.** `tools`, `size`, `sym`, `color`, `undo`, `export`. Uppercase is reserved for the model number alone.
- Coordinates zero-pad to three digits (`x 042 y 156`) — instrument readouts don't jitter.
- No hard drop shadows on type, no soft ones either. Type sits flat on its surface.

## 5. Control system

The component vocabulary is hardware. Draw it all in CSS — flat fills, 1px borders, one hard shadow — never bitmaps.

```css
/* Key cap — every pressable control */
.key {
  background: var(--key);
  border: 1px solid var(--key-border);
  border-radius: 5px;
  box-shadow: 0 2px 0 var(--key-shadow);   /* the key's physical depth */
}
.key:active { transform: translateY(2px); box-shadow: none; }  /* it depresses */
```

- **Active tool key:** cap turns `--charcoal`, icon turns `--orange`, and the key's 4px LED dot lights with a soft orange glow. Inactive LEDs stay `--key-border` gray — visible but dark, like real hardware.
- **Toggle banks** (symmetry): active segment fills solid orange with white text.
- **Color chips:** circles, 19px, hairline border; selection is a 2px orange ring offset 2px. The current-color well is a larger chip.
- **The canvas bezel:** a light well — `--ground` fill, hairline `--key-border` edge, 8px padding, soft inner shadow — so black ink at the art's edge never merges with the surround. Charcoal is reserved for information surfaces (LCD, badge, active keys).
- **The LCD strip:** charcoal bar, mono type, dim gray field labels (`tool`, `x`, `y`, `sym`) with values in lcd-text; live/changed values in orange; a blinking orange block cursor closes the tip line (disabled under `prefers-reduced-motion`).
- **Corner screws** on the device body are the single permitted hardware flourish. Do not add speaker grilles, fake ports, or woodgrain.
- Focus-visible state everywhere: `2px solid var(--orange)`, offset 2px.
- Corner radii: device 14px, keys/bezel 5–9px, chips fully round. Nothing else is rounded.

## 6. Iconography

- Tool icons are inline SVG line icons, ~21px on a 42px key, `stroke-width` 1.6, drawn in `currentColor` so they inherit key state (ink at rest, orange when active).
- Literal, single-weight, no fills except tiny functional details (spray dots, the fill-bucket drip) — or when the fill *is* the state being reported, as on a shape tool set to draw filled.
- Transport keys may use plain glyph characters (`↺`, `×`, `↓`) with a mono label beneath — symbol above, word below, like a printed panel.

## 7. Voice & copy

Deadpan instrument-manual. Lowercase. Short declaratives. The wit is in the precision, not in jokes.

- LCD tips are the voice's home: *"hold still for density"*, *"back to paper. no shame in it"*.
- Controls are labeled with exactly one word where possible: `undo`, `clear`, `export`.
- No exclamation points, no emoji, no "please". Periods optional; when in doubt, drop them.
- Files export as `pattern.png`. Documents are just documents — no cute extensions.

## 8. Motion

Physical, minimal, instant.

- The key press (2px travel, shadow collapses) is the core interaction feel. It is a transform, not a transition — it snaps.
- The LCD cursor blink (steps, ~1.1s) is the only idle animation. Both it and the key travel respect `prefers-reduced-motion`.
- No fades, no easing curves, no springs. State changes at the speed of a switch.

## 9. The signature feature

**Symmetry drawing (2× / 4× / 8× mandala)** remains the product's soul: it's what makes this a *pattern* maker, and it makes anyone's first thirty seconds productive. In the new identity it presents as a labeled toggle bank (`sym · off 2 4 8`) and the empty-canvas state ships with an orange 8× mandala already drawn. Marketing and screenshots always show symmetry output.

## 10. Do / Don't

| Do | Don't |
|---|---|
| One accent: orange means live | A second accent color, ever |
| Warm gray plastic, charcoal displays | Pure `#808080` / `#FFFFFF` chrome, cool blues |
| Flat fills, 1px borders, one hard key shadow | Gradients, bevels, glassmorphism, blurs |
| Lowercase mono labels, tabular readouts | Title Case, bold display type in chrome |
| Physical metaphors that behave physically | Skeuomorphic textures (brushed metal, leather, woodgrain) |
| Calm surface, loud artwork | Chrome that competes with the canvas |

## 11. Reference implementation

The living reference is the demo: [demo/pattern-maker-demo.html](demo/pattern-maker-demo.html) — a self-contained, working instrument (pencil, brush, spray, eraser, line/rect/ellipse, flood fill, symmetry modes, undo, png export) built entirely from the tokens and rules above. When this document and the demo disagree, fix one of them in the same change.

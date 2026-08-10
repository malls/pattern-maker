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
| `--charcoal` | `#1B1B1A` | LCD strip, canvas bezel, active tool keys, badge |
| `--lcd-text` | `#E8E6DF` | Light text on charcoal |
| `--orange` | `#FF4E00` | **The accent.** LEDs, active states, primary action, focus rings, live values |

**Rules of engagement**

- Orange marks *state and action*, never decoration: a lit LED, an active toggle, the export key, the current value on the LCD, a focus ring. If orange appears somewhere nothing is happening, remove it.
- Charcoal surfaces are where information lives (readouts, the canvas bezel, active keys). Plastic surfaces are where hands go. Keep the two roles distinct.
- No gradients on any surface. The only permitted "lighting" is the device's inset top highlight, the key drop shadow, and the LED glow (`0 0 5px rgba(255,78,0,.9)`). Two functional exceptions: the corner screws' machined shading and the custom-color well's spectrum ring — both tiny, both earn it.
- Text is ink-on-plastic or lcd-text-on-charcoal. Never set text in orange except single live values on the LCD.

### The drawing palette

The 16 in-canvas color chips (warm neutrals row, then a restrained industrial color row: orange, red `#D22E2E`, yellow `#F2B500`, green `#3E9B4F`, teal `#2E8B8B`, blue `#2E5FD2`, violet `#7B4FD2`, magenta `#C43E8F`, pink `#F2A0B8`, brown `#8A5A3B`, cream `#EFE6D0`) live in the demo source and are part of the brand — slightly muted, screen-print flavored, nothing neon. User artwork may be loud; the chips that make it should still look considered.

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
- **The canvas bezel:** charcoal, 8px padding, inner shadow — the canvas is the device's screen.
- **The LCD strip:** charcoal bar, mono type, dim gray field labels (`tool`, `x`, `y`, `sym`) with values in lcd-text; live/changed values in orange; a blinking orange block cursor closes the tip line (disabled under `prefers-reduced-motion`).
- **Corner screws** on the device body are the single permitted hardware flourish. Do not add speaker grilles, fake ports, or woodgrain.
- Focus-visible state everywhere: `2px solid var(--orange)`, offset 2px.
- Corner radii: device 14px, keys/bezel 5–9px, chips fully round. Nothing else is rounded.

## 6. Iconography

- Tool icons are inline SVG line icons, ~21px on a 42px key, `stroke-width` 1.6, drawn in `currentColor` so they inherit key state (ink at rest, orange when active).
- Literal, single-weight, no fills except tiny functional details (spray dots, the fill-bucket drip).
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

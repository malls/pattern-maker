# PM-2: Rebrand: Photoshop-by-teenage-engineering direction for BRANDING.md + demo

## Context

PM-1 delivered a Memphis/Win95 "90s but slick" identity. The user redirected: the brand
should feel like *Photoshop if teenage engineering made it* — industrial-instrument
minimalism (OP-1 / EP-133 lineage), not desktop-OS nostalgia. Rework both deliverables
in place; the artifact keeps its URL.

## Design direction

- **Product-as-device:** the app is a hardware instrument. Name leans in: **pattern
  maker PM–1** (TE model-number naming; happily matches the Lattice code).
- **Color:** warm light-gray plastic body (#E4E3DF family), charcoal display panel
  (#1B1B1A), near-black ink, and exactly one loud accent — TE orange #FF4E00.
  Grays are warm-biased, chrome is matte, zero gradients.
- **Type:** lowercase grotesk for the wordmark (Helvetica Neue stack), tiny lowercase
  monospace labels (ui-monospace stack) everywhere else, tabular figures on readouts.
- **Controls:** flat key-cap buttons (1px border, 4px radius, hard 2px bottom shadow,
  press = translate down + shadow gone), orange LED dots for active state, circular
  color chips, stepped size selector, dark LCD readout strip for tool/coords/sym.
- **Layout:** one device panel on a plain light ground with a fine dot grid; tool key
  matrix left, canvas in a thin dark bezel, chips/steppers/transport keys below,
  LCD status strip. Corner screws as the single playful hardware flourish.
- Keep the signature symmetry feature (2×/4×/8×) — presented as a labeled toggle
  bank with LEDs.

## Key files

- `BRANDING.md` — full rewrite to the new identity (same structure: essence, name,
  color tokens, type, control system, voice, motion, do/don't, reference).
- `demo/pattern-maker-demo.html` — full visual rework; drawing engine (tools, undo,
  flood fill, symmetry, export) is sound and carries over. Republish artifact to the
  SAME URL (same file path, favicon 🎨).

## Acceptance criteria

- BRANDING.md and demo share exact token values; no leftover Memphis/Win95 tokens
  (#CDC7BE putty, #12A594 teal, #E93D82 magenta, #FFC53D yellow, bevel box-shadows,
  Tahoma stacks) in either file.
- Demo still fully functional: 8 tools, sizes, symmetry, undo, clear, export, keyboard,
  touch; no external resources; explicit backgrounds (single-theme by choice);
  no horizontal page scroll at narrow widths.
- The look reads unmistakably TE: one accent color, mono lowercase labels, flat keys,
  LED states, LCD readout.

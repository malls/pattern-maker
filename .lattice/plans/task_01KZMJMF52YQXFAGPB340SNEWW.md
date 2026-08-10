# Plan: PM-1 — BRANDING.md + demo HTML artifact

## Scope

Two deliverables for Pattern Maker, a graphic drawing software:

1. `BRANDING.md` at repo root — the brand identity document: name/wordmark, voice,
   color palette (with hex values), typography, UI chrome rules (the "90s but slick"
   design language), iconography, and do/don't guidance. This is the reference future
   UI work will be built against.
2. A demo HTML artifact — a *working* single-file drawing app that embodies the brand:
   canvas with pencil/eraser/shapes/fill, color palette, brush sizes, undo, clear,
   PNG export. Published via the Artifact tool so it's shareable.

## Design direction: "90s, but slick"

- Chrome: raised/sunken bevels, title bar with gradient, chunky toolbar buttons —
  the Win95/MacOS-8 vocabulary — but rendered with modern spacing, crisp CSS
  (no images), smooth pointer-event drawing, and forgiving hit targets.
- Palette: warm gray chrome + one loud accent set (teal/magenta/yellow — the
  Memphis-design 90s trio), defined as CSS tokens in both the doc and the demo.
- Type: pixel-flavored display type for the wordmark (system fallback stack, since
  artifacts can't load external fonts), clean system sans for UI copy.
- Both deliverables must use the *same* token values so the doc and demo agree.

## Key files

- `BRANDING.md` (new, repo root)
- Demo HTML written to scratchpad, published with the Artifact tool (favicon 🎨).
  A copy saved as `demo/pattern-maker-demo.html` in the repo so the artifact source
  is versioned alongside the brand doc.

## Constraints

- Artifact must be fully self-contained (CSP: no external fonts/scripts/images).
- Theme-aware enough not to break in dark mode viewers, but the app deliberately
  commits to its own 90s chrome look (explicit backgrounds everywhere).
- Load the `artifact-design` skill before writing the page (harness requirement).

## Acceptance criteria

- BRANDING.md exists, self-consistent, includes concrete hex values, type stack,
  bevel/chrome specs, voice guidance, and references the demo.
- Demo artifact: drawing works (mouse + touch via pointer events), tool switching,
  color selection, undo, export PNG; visual language matches BRANDING.md tokens;
  no horizontal page scroll; renders acceptably in light and dark viewer themes.
- Both files committed-ready in the repo (no git repo yet, so: present on disk).

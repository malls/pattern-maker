# PM-5: Remove dark bezel around drawing surface — light well so black ink stays visible

## Problem

The editor canvas sits in a `--charcoal` (#1B1B1A) bezel (app: `src/styles/app.css` `.bezel`,
letterbox shows through the transparent canvas; demo: `.bezel` in
`demo/pattern-maker-demo.html`). Drawing with black/near-black ink at the art's edge is
confusing — the artwork visually merges with the surround. Human-reported (PM-5).

## Change

Replace the dark surround of the **drawing surface** with a light well; charcoal remains
the color of *readouts* (LCD strip, badge, active keys) per the brand's information/hands
split.

1. `src/styles/app.css` — `.bezel`: `background: var(--ground)` (#D3D2CD), border
   `1px solid var(--key-border)`, keep the existing inset shadow but soften to suit a light
   surface (e.g. `inset 0 1px 3px rgba(35,35,32,.18)`). Radius/padding/height unchanged.
2. `src/editor/grid-editor.ts` — comments mentioning "charcoal letterbox" updated; no logic
   change (letterbox already shows the bezel background through the cleared canvas).
3. `src/editor/chrome.ts` — `drawFocusMinimap` hairlines/fills currently sized for a dark
   ground: flip to ink-on-light (hairlines `rgba(35,35,32,.45)`, focused cell solid
   `--orange` as today, border-center hollow dim). Verify contrast of any other letterbox
   drawing.
4. `BRANDING.md` §5 — bezel bullet: the canvas sits in a **light well** (`--ground`,
   hairline `--key-border` edge); charcoal is reserved for information surfaces (LCD,
   badge, active keys). Keep the "canvas is the device's screen" metaphor out or rephrase.
5. `demo/pattern-maker-demo.html` — same treatment for its `.bezel` (background --ground,
   hairline border, softened inset). Keeps §11's doc/demo agreement. Artifact republish is
   handled by the orchestrator after review.

## Acceptance criteria

- No charcoal/near-black surface is adjacent to the drawing area in either mode, focused
  or unfocused, at any cell size (letterbox included).
- Black ink drawn at the outer edge of the art remains clearly distinguishable from the
  surround.
- Minimap remains legible on the light well.
- LCD strip, badge, and active-key charcoal unchanged.
- BRANDING.md and demo agree with the app.
- `npx tsc --noEmit` and `npm run build` clean.

Complexity: low.

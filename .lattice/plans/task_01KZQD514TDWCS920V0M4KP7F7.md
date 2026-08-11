# PM-12: Rainbow palette from CSS named colors + add neon palette

Human-requested, two changes to `src/state/palettes.ts` (+ BRANDING.md §3).
Complexity: low — pure data plus one doc edit. No UI, state, or persistence work.

## 1. `rainbow` becomes CSS named colors

Human's words: *"'rainbow' should be the colors known to css as 'blue' 'red' 'yellow' etc."*
So every hue slot must be an exact CSS named color, not a screen-print interpretation
of one. This deliberately overrides BRANDING §3's "nothing neon" guidance **for this
palette** — the user's direction wins (see §3 doc edit below).

Slot contract is preserved: slot 0 = ink, slot 4 = `#FBFAF8` paper. Paper stays paper —
per the existing rationale, "you print onto one stock; the inks change" — so slot 4 is
NOT changed to CSS `white`. Slots 0–3 use CSS grays so the whole set is honestly named.

Replace `rainbow`'s swatches with exactly (in slot order):

```
"#000000", "#696969", "#808080", "#C0C0C0",   /* black, dimgray, gray, silver */
"#FBFAF8", "#FF0000", "#FF4500", "#FFA500",   /* paper, red, orangered, orange */
"#FFD700", "#FFFF00", "#00FF00", "#008000",   /* gold, yellow, lime, green */
"#00FFFF", "#0000FF", "#4B0082", "#FF00FF",   /* cyan, blue, indigo, magenta */
```

Eleven hues in one ordered sweep (red → orangered → orange → gold → yellow → lime →
green → cyan → blue → indigo → magenta), matching the existing comment that rainbow
"spends all eleven on one sweep, on purpose". Every value above is a real CSS keyword;
the implementer must not substitute near-values.

Update `rainbow`'s `tip` to name what it now is, in brand voice (lowercase, deadpan) —
suggested: `"rainbow. the css keywords, straight"`. Update its code comment to say the
swatches are CSS named colors and must stay exact.

## 2. New `neon` palette

Sixth palette, same 16-slot contract, appended to `PALETTES` after `rainbow` (so the
stepper order runs shop → mono → pastel → gem → rainbow → neon and `shop` stays first
and default). Add `"neon"` to the `PaletteId` union.

Neon lives on dark, so its spine is a blue-violet-biased near-black rather than the
brand's warm grays — a deliberate, documented departure, since a neon set on warm putty
grays reads muddy.

```
id: "neon", label: "neon", tip: "neon. loud on a dark ground"
"#0B0B12", "#1E1B2E", "#4A4468", "#8F86B8",   /* spine: ink → dusk */
"#FBFAF8", "#FF1D58", "#FF6B00", "#FFD400",   /* paper, rose, orange, yellow */
"#C6FF00", "#39FF14", "#00FFC6", "#00E5FF",   /* acid, green, mint, cyan */
"#00A3FF", "#4D5BFF", "#B026FF", "#FF00E5",   /* azure, blue, purple, magenta */
```

Eleven hues, same ordered-sweep logic as rainbow.

## 3. BRANDING.md §3 edit

§3 currently states palettes are "slightly muted, screen-print flavored, nothing neon"
and lists five sets. Required edits:

- Add the `rainbow` (revised) and `neon` hex blocks; correct the count from five to six.
- Amend the "nothing neon" rule so it is scoped honestly rather than contradicted: the
  house set (`shop`) and all chrome stay muted and screen-print flavored; named palettes
  may depart deliberately where the scheme's own name demands it (`rainbow` is exact CSS
  keywords; `neon` is built to glow). State that the departure is per-palette and never
  applies to chrome or the accent.
- Note the two contract carve-outs: slot 4 remains `#FBFAF8` in all six, and `neon` is
  the one palette whose spine is cool rather than warm-biased, with the one-line reason.

## Acceptance criteria

- `rainbow` slots 5–15 and 0–3 are exactly the CSS keyword values listed above; a
  reviewer can verify each against the CSS named-color table.
- `neon` exists as the sixth palette, 16 valid distinct hexes, appended after `rainbow`.
- Slot contract holds in all six: slot 0 dark ink, slot 4 == `#FBFAF8`.
- Stepper cycles all six and wraps; `shop` still default; `[`/`]` unchanged.
- A project saved with `palette: "neon"` round-trips; unknown ids still fall back to
  `shop` and never reject the file.
- BRANDING.md §3 lists all six with hexes matching source exactly, and the "nothing neon"
  rule is scoped, not silently contradicted.
- `npx tsc --noEmit` and `npm run build` clean.

## Out of scope

No changes to chips UI, stepper, persistence logic, LCD, chrome, or the demo (which
ships `shop` and is unaffected).

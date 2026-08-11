# PM-13: Tile preview: add repeat 2x swatch between 4x and 1x

Human-requested. Complexity: low — one file, additive.

`src/preview/tile-preview.ts` currently renders two swatches: `repeat 4×` (background-size
`4C`) then `repeat 1×` (`auto`). Add a third swatch labeled `repeat 2×` between them, so
the column reads 4×, 2×, 1× top to bottom. Implementation mirrors the existing pair
exactly: a third `.tp-swatch` div in its own `.tp-item`, included in the shared
`backgroundImage`/`backgroundRepeat` loop, with `backgroundSize = cellSize * 2`. No CSS
changes needed (`.tp-swatch` height is fixed at 158px and the column is a grid with gap).
File header comment updated to say "at 4×, 2×, and native size".

Out of scope: border preview (has its own 2× study from PM-9), exports, LCD, demo.

## Acceptance criteria

- Tile mode shows three swatches in order 4×, 2×, 1×, labels in the existing lowercase
  mono style; 2× uses background-size `2·cellSize`, pixelated, seam-free like the others.
- All three update live from the same data URI on every preview refresh.
- Nothing else changes: `npx tsc --noEmit` and `npm run build` clean; no other file touched.

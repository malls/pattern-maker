# PM-14: Tile preview loses its 12px gap: refreshPreviews resets style.display, wiping inline display:grid

`createTilePreview` sets `root.style.display = "grid"` and `gap: 12px` inline;
`refreshPreviews` in src/main.ts toggles preview visibility with `style.display = "none"` /
`""`, and the empty string erases the inline grid, so the swatch column loses its gap
after the first mode round-trip.

Fix: give the tile preview root `className: "tp-col"` and move `display: grid; gap: 12px`
into a `.tp-col` rule in app.css; delete the inline style lines. `style.display = ""` then
falls back to the class rule. Border preview root needs no change (its layout lives on the
`.bp-grid` child, not the toggled root).

Acceptance: tile swatches keep their 12px gap after switching modes back and forth;
tsc + build clean; only tile-preview.ts and app.css touched. Complexity: low.

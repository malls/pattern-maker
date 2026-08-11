<img src="public/favicon.svg" width="64" height="64" alt="the PM–1 mark">

# pattern maker `PM–1`

**professional pattern instrument** — a drawing tool for CSS border-images and
seamless tiles. pixels in, patterns out.

**Use it now: [malls.github.io/pattern-maker](https://malls.github.io/pattern-maker/)**

## what it does

Two modes, one 3×3 grid:

- **border** — draw the eight slice regions of a CSS
  [`border-image`](https://developer.mozilla.org/en-US/docs/Web/CSS/border-image).
  The center stays empty (that's how border-images work). Four live sample boxes
  show your border under every `border-image-repeat` rule, plus a pixel-doubled
  study. Copy ready-to-paste CSS with the image inlined as a data URI.
- **tile** — draw one seamless tile on a torus: the grid shows nine copies of the
  same tile, and strokes that cross an edge wrap to the opposite side. Live
  previews at 4×, 2×, and native size. Export the tile or copy
  `background-image` CSS.

Everything runs in the browser. No backend, no accounts, no telemetry — your
work autosaves to localStorage and exports as PNG, CSS, or a `pattern.json`
project file.

## features

- pixel editor with pencil, eraser, line, rect, ellipse (outline or filled —
  click the active tool to toggle), flood fill, and eyedropper
- rect select with copy / cut / paste — pastes float until you stamp them, and
  wrap around the tile seam
- zoom to a single cell for detail work (`z`)
- any cell size from 1 to 64 px; export at 1×/2×/4× (nearest-neighbor, so the
  pixels stay pixels)
- six drawing palettes: shop, mono, pastel, gem, rainbow (the CSS keywords,
  straight), neon
- undo/redo, keyboard-first, and an LCD that tells you what's going on

## keys

| key | does |
|---|---|
| `p` `e` `l` `r` `o` `f` `i` | pencil / eraser / line / rect / ellipse / fill / eyedropper |
| `m` | select (then `⌘C` `⌘X` `⌘V`, `Enter` stamps, `Esc` cancels) |
| `z` | zoom to one cell · arrows move between cells · `Esc` exits |
| `1` `2` | border mode / tile mode |
| `[` `]` | previous / next palette |
| `⌘Z` / `⇧⌘Z` | undo / redo |

## desktop

Native desktop builds (macOS, Windows, Linux) are published on the
[releases page](https://github.com/malls/pattern-maker/releases) — small Tauri
binaries of the same instrument. The builds are unsigned for now: on macOS,
right-click → Open the first time.

## development

```sh
npm install
npm run dev        # vite dev server
npm run build      # typecheck + production build to dist/
```

Vite + vanilla TypeScript, zero runtime dependencies. The drawing core
(`src/raster/`, `src/state/`) is DOM-free on purpose. Visual identity lives in
[BRANDING.md](BRANDING.md); task history in `.lattice/`.

## license

[GPL-3.0](LICENSE).

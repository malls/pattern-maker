/** Border mode output: four sample boxes with real CSS border-image applied,
 *  one per border-image-repeat variant, plus a fifth full-width study that
 *  draws the same sheet at double size. The four variant boxes are 158px —
 *  deliberately not a multiple of any slice size, so repeat/round/space
 *  actually differ. */

import { h } from "../ui/dom";

const VARIANTS = ["stretch", "repeat", "round", "space"] as const;

/** keep in sync with `.bp-box` in app.css — the variant boxes' fixed size, and
 *  the floor for the 2× study's computed size */
const BOX_PX = 158;

export interface BorderPreview {
  root: HTMLElement;
  update(uri: string, cellSize: number): void;
}

export function createBorderPreview(): BorderPreview {
  const boxes = new Map<string, HTMLElement>();
  const grid = h("div", { className: "bp-grid" });
  for (const v of VARIANTS) {
    const box = h("div", { className: "bp-box" });
    boxes.set(v, box);
    grid.append(h("div", { className: "bp-item" }, box, h("span", { text: v })));
  }
  // the fifth item: `repeat`, drawn twice as large. Not a fifth variant and
  // not an export-scale preview — the raster is the same 1× URI throughout.
  const twoBox = h("div", { className: "bp-box" });
  grid.append(
    h("div", { className: "bp-item bp-item-wide" }, twoBox, h("span", { text: "repeat 2×" })),
  );
  const root = h("div", {}, grid);
  return {
    root,
    update(uri, cellSize) {
      for (const [variant, box] of boxes) {
        // border-style solid + transparent border color are load-bearing:
        // without them border-image renders nothing in some browsers.
        box.style.border = `${cellSize}px solid transparent`;
        box.style.borderImage = `url("${uri}") ${cellSize} ${variant}`;
      }
      // border-width doubles while the slice stays cellSize: the slice is
      // measured in *image* pixels, so the browser scales the same art up 2×.
      // `.bp-box`'s image-rendering: pixelated is what keeps that crisp.
      const bw = cellSize * 2;
      // box-sizing: border-box would let a declared 158px with a 128px border
      // per side silently inflate the used width — size the box off the border
      // instead, keeping at least a 64px content strip so it reads as a frame.
      const size = Math.max(BOX_PX, bw * 2 + 64);
      twoBox.style.width = `${size}px`;
      twoBox.style.height = `${size}px`;
      twoBox.style.border = `${bw}px solid transparent`;
      twoBox.style.borderImage = `url("${uri}") ${cellSize} repeat`;
    },
  };
}

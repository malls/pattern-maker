/** Tile mode output: the tile repeating as a real CSS background at 4×, 2×,
 *  and native size. All pixelated, no seams. */

import { h } from "../ui/dom";

export interface TilePreview {
  root: HTMLElement;
  update(uri: string, cellSize: number): void;
}

export function createTilePreview(): TilePreview {
  const native = h("div", { className: "tp-swatch" });
  const doubled = h("div", { className: "tp-swatch" });
  const zoomed = h("div", { className: "tp-swatch" });
  const root = h(
    "div",
    {},
    h("div", { className: "tp-item" }, zoomed, h("span", { text: "repeat 4×" })),
    h("div", { className: "tp-item" }, doubled, h("span", { text: "repeat 2×" })),
    h("div", { className: "tp-item" }, native, h("span", { text: "repeat 1×" })),
  );
  root.style.display = "grid";
  root.style.gap = "12px";
  return {
    root,
    update(uri, cellSize) {
      for (const el of [native, doubled, zoomed]) {
        el.style.backgroundImage = `url("${uri}")`;
        el.style.backgroundRepeat = "repeat";
      }
      native.style.backgroundSize = "auto";
      doubled.style.backgroundSize = `${cellSize * 2}px ${cellSize * 2}px`;
      zoomed.style.backgroundSize = `${cellSize * 4}px ${cellSize * 4}px`;
    },
  };
}

/** Border mode output: four sample boxes with real CSS border-image applied,
 *  one per border-image-repeat variant. The boxes are 158px — deliberately
 *  not a multiple of any slice size, so repeat/round/space actually differ. */

import { h } from "../ui/dom";

const VARIANTS = ["stretch", "repeat", "round", "space"] as const;

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
    },
  };
}

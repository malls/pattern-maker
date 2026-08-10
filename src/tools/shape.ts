/** Shared machinery for drag shapes (line/rect/ellipse): snapshot on down,
 *  restore + re-rasterize on every move, commit on up. */

import type { Plot } from "../raster/raster";
import type { Pt, Tool, ToolContext } from "./types";

type Raster = (x0: number, y0: number, x1: number, y1: number, plot: Plot) => void;

export function makeShapeTool(
  id: string,
  hotkey: string,
  label: string,
  tip: string,
  raster: Raster,
): Tool {
  let start: Pt | null = null;
  const draw = (to: Pt, ctx: ToolContext): void => {
    if (!start) return;
    raster(start.x, start.y, to.x, to.y, (x, y) => ctx.plot(x, y));
  };
  return {
    id,
    hotkey,
    label,
    tip,
    onDown(p, ctx) {
      ctx.beginStroke();
      ctx.snapshot();
      start = p;
      draw(p, ctx);
    },
    onMove(p, ctx) {
      if (!start) return;
      ctx.restore();
      draw(p, ctx);
    },
    onUp(p, ctx) {
      if (!start) return;
      ctx.restore();
      draw(p, ctx);
      start = null;
      ctx.commit();
    },
  };
}

import { line } from "../raster/raster";
import type { Pt, Tool, ToolContext } from "./types";

let prev: Pt | null = null;

export const pencil: Tool = {
  id: "pencil",
  hotkey: "p",
  label: "pencil",
  tip: "hard line. honest pixels",
  onDown(p: Pt, ctx: ToolContext): void {
    ctx.beginStroke();
    ctx.plot(p.x, p.y);
    prev = p;
  },
  onMove(p: Pt, ctx: ToolContext): void {
    if (!prev) return;
    line(prev.x, prev.y, p.x, p.y, (x, y) => ctx.plot(x, y));
    prev = p;
  },
  onUp(_p: Pt, ctx: ToolContext): void {
    prev = null;
    ctx.commit();
  },
};

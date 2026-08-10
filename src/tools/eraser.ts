import { line } from "../raster/raster";
import type { Pt, Tool, ToolContext } from "./types";

let prev: Pt | null = null;

/** Plots transparency (0x00000000), NOT paper color — outputs need alpha. */
export const eraser: Tool = {
  id: "eraser",
  hotkey: "e",
  label: "eraser",
  tip: "back to transparent. no shame in it",
  onDown(p: Pt, ctx: ToolContext): void {
    ctx.beginStroke();
    ctx.erase(p.x, p.y);
    prev = p;
  },
  onMove(p: Pt, ctx: ToolContext): void {
    if (!prev) return;
    line(prev.x, prev.y, p.x, p.y, (x, y) => ctx.erase(x, y));
    prev = p;
  },
  onUp(_p: Pt, ctx: ToolContext): void {
    prev = null;
    ctx.commit();
  },
};

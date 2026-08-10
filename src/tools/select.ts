/** Rect marquee. A passive tool: it marks a region, it never draws. Copy /
 *  cut / paste live on the keyboard; history is pushed by those actions. */

import { rectFromPoints } from "../state/selection";
import type { Pt, Tool, ToolContext } from "./types";

let anchor: Pt | null = null;
let moved = false;

export const selectTool: Tool = {
  id: "select",
  hotkey: "m",
  label: "select",
  tip: "box it up. then copy cut paste",
  passive: true,
  clampToWindow: true,
  onDown(p: Pt, ctx: ToolContext): void {
    anchor = p;
    moved = false;
    ctx.setSelection({ x: p.x, y: p.y, w: 1, h: 1 });
  },
  onMove(p: Pt, ctx: ToolContext): void {
    if (!anchor) return;
    if (p.x !== anchor.x || p.y !== anchor.y) moved = true;
    ctx.setSelection(rectFromPoints(anchor.x, anchor.y, p.x, p.y));
  },
  onUp(p: Pt, ctx: ToolContext): void {
    if (!anchor) return;
    if (p.x !== anchor.x || p.y !== anchor.y) moved = true;
    // a pure click (never left the anchor pixel) deselects
    if (!moved) ctx.setSelection(null);
    else ctx.setSelection(rectFromPoints(anchor.x, anchor.y, p.x, p.y));
    anchor = null;
    moved = false;
  },
};

/** Rect marquee. A passive tool: it marks a region, it never draws. Copy /
 *  cut / paste live on the keyboard; history is pushed by those actions. */

import { rectFromPoints } from "../state/selection";
import type { Pt, Tool, ToolContext } from "./types";

let anchor: Pt | null = null;
let moved = false;
/** grab offset inside the float while dragging it */
let grab: Pt | null = null;

export const selectTool: Tool = {
  id: "select",
  hotkey: "m",
  label: "select",
  tip: "box it up. then copy cut paste",
  passive: true,
  clampToWindow: true,
  onDown(p: Pt, ctx: ToolContext): void {
    anchor = null;
    grab = null;
    moved = false;
    const f = ctx.getFloat();
    if (f) {
      if (p.x >= f.x && p.x < f.x + f.w && p.y >= f.y && p.y < f.y + f.h) {
        grab = { x: p.x - f.x, y: p.y - f.y }; // drag it
      } else {
        ctx.stampFloat(); // click outside commits; the press starts nothing
      }
      return;
    }
    anchor = p;
    ctx.setSelection({ x: p.x, y: p.y, w: 1, h: 1 });
  },
  onMove(p: Pt, ctx: ToolContext): void {
    if (grab) {
      ctx.moveFloatTo(p.x - grab.x, p.y - grab.y);
      return;
    }
    if (!anchor) return;
    if (p.x !== anchor.x || p.y !== anchor.y) moved = true;
    ctx.setSelection(rectFromPoints(anchor.x, anchor.y, p.x, p.y));
  },
  onUp(p: Pt, ctx: ToolContext): void {
    if (grab) {
      ctx.moveFloatTo(p.x - grab.x, p.y - grab.y);
      grab = null;
      return;
    }
    if (!anchor) return;
    if (p.x !== anchor.x || p.y !== anchor.y) moved = true;
    // a pure click (never left the anchor pixel) deselects
    if (!moved) ctx.setSelection(null);
    else ctx.setSelection(rectFromPoints(anchor.x, anchor.y, p.x, p.y));
    anchor = null;
    moved = false;
  },
};

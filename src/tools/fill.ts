import type { Pt, Tool, ToolContext } from "./types";

export const fillTool: Tool = {
  id: "fill",
  hotkey: "f",
  label: "fill",
  tip: "click a region to flood it",
  onDown(p: Pt, ctx: ToolContext): void {
    ctx.beginStroke();
    ctx.fill(p.x, p.y);
    ctx.commit();
  },
  onMove(): void {},
  onUp(): void {},
};

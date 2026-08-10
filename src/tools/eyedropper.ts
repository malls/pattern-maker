import type { Pt, Tool, ToolContext } from "./types";

/** Click picks the color under the cursor into the current color. Alt+click
 *  does the same with any tool (wired in the editor's pointer handling). */
export const eyedropper: Tool = {
  id: "eyedropper",
  hotkey: "i",
  label: "eyedropper",
  tip: "click to lift a color",
  onDown(p: Pt, ctx: ToolContext): void {
    ctx.pick(p.x, p.y);
  },
  onMove(): void {},
  onUp(): void {},
};

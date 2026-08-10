/** Tool registry + hotkey map. */

import { ellipseTool } from "./ellipse";
import { eraser } from "./eraser";
import { eyedropper } from "./eyedropper";
import { fillTool } from "./fill";
import { lineTool } from "./line";
import { pencil } from "./pencil";
import { rectTool } from "./rect";
import { selectTool } from "./select";
import type { Tool } from "./types";

export const TOOLS: readonly Tool[] = [
  pencil,
  eraser,
  lineTool,
  rectTool,
  ellipseTool,
  fillTool,
  eyedropper,
  selectTool,
];

export function toolById(id: string): Tool {
  return TOOLS.find((t) => t.id === id) ?? pencil;
}

export function toolByHotkey(key: string): Tool | null {
  return TOOLS.find((t) => t.hotkey === key) ?? null;
}

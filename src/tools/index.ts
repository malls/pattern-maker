/** Tool registry + hotkey map. */

import { eraser } from "./eraser";
import { pencil } from "./pencil";
import type { Tool } from "./types";

export const TOOLS: readonly Tool[] = [pencil, eraser];

export function toolById(id: string): Tool {
  return TOOLS.find((t) => t.id === id) ?? pencil;
}

export function toolByHotkey(key: string): Tool | null {
  return TOOLS.find((t) => t.hotkey === key) ?? null;
}

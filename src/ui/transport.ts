/** Transport keys: undo redo clear save load css export. */

import { h } from "./dom";

export type TransportAction =
  | "undo"
  | "redo"
  | "clear"
  | "save"
  | "load"
  | "css"
  | "export";

const KEYS: readonly { id: TransportAction; glyph: string; label: string; title: string; primary?: boolean }[] = [
  { id: "undo", glyph: "↺", label: "undo", title: "undo (ctrl+z)" },
  { id: "redo", glyph: "↻", label: "redo", title: "redo (ctrl+shift+z)" },
  { id: "clear", glyph: "×", label: "clear", title: "clear canvas" },
  { id: "save", glyph: "↧", label: "save", title: "save project json" },
  { id: "load", glyph: "↥", label: "load", title: "load project json" },
  { id: "css", glyph: "{}", label: "css", title: "copy css snippet" },
  { id: "export", glyph: "↓", label: "export", title: "export png", primary: true },
];

export interface TransportView {
  root: HTMLElement;
}

export function createTransport(onAction: (id: TransportAction) => void): TransportView {
  const root = h("div", { className: "transport" });
  for (const k of KEYS) {
    const b = h(
      "button",
      { className: k.primary ? "t-key primary" : "t-key", title: k.title },
      h("span", { className: "cap", text: k.glyph }),
      h("span", { text: k.label }),
    );
    b.addEventListener("click", () => onAction(k.id));
    root.append(b);
  }
  return { root };
}

/** Transport keys: undo redo clear save load css [− scale +] export. */

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

export interface TransportSpec {
  onAction(id: TransportAction): void;
  /** Step the export scale by ±1 position through {1,2,4}. */
  onScaleStep(delta: number): void;
}

export interface TransportView {
  root: HTMLElement;
  sync(s: { exportScale: number }): void;
}

export function createTransport(spec: TransportSpec): TransportView {
  const root = h("div", { className: "transport" });

  // export-scale stepper — the cell stepper's vocabulary, three values only,
  // so the readout is an inert display rather than a click-to-type field.
  const readout = h("span", {
    className: "readout",
    text: "1×",
    attrs: { "aria-live": "polite", "aria-label": "export scale" },
  });
  const minus = h("button", {
    className: "key",
    text: "−",
    title: "smaller export",
    attrs: { "aria-label": "smaller export" },
  });
  const plus = h("button", {
    className: "key",
    text: "+",
    title: "larger export",
    attrs: { "aria-label": "larger export" },
  });
  minus.addEventListener("click", () => spec.onScaleStep(-1));
  plus.addEventListener("click", () => spec.onScaleStep(1));
  const scaleGroup = h(
    "div",
    { className: "t-group", attrs: { role: "group", "aria-label": "export scale" } },
    h("div", { className: "stepper t-scale" }, minus, readout, plus),
    h("span", { text: "scale" }),
  );

  for (const k of KEYS) {
    if (k.id === "export") root.append(scaleGroup); // … css [− 1× +] export
    const b = h(
      "button",
      { className: k.primary ? "t-key primary" : "t-key", title: k.title },
      h("span", { className: "cap", text: k.glyph }),
      h("span", { text: k.label }),
    );
    b.addEventListener("click", () => spec.onAction(k.id));
    root.append(b);
  }

  return {
    root,
    sync(s) {
      readout.textContent = `${s.exportScale}×`;
    },
  };
}

/** Charcoal status strip: tool, x/y, mode, cell, tip, blinking cursor. */

import { h } from "./dom";

export interface LcdState {
  tool: string;
  hover: { x: number; y: number } | null;
  mode: string;
  cellSize: number;
  tip: string;
}

export interface LcdView {
  root: HTMLElement;
  sync(state: LcdState): void;
}

const pad3 = (n: number): string => String(n).padStart(3, "0");

export function createLcd(): LcdView {
  const toolEl = h("b", { text: "pencil" });
  const xEl = h("span", { text: "—" });
  const yEl = h("span", { text: "—" });
  const modeEl = h("b", { text: "border" });
  const cellEl = h("span", { text: "016" });
  const tipEl = h("span", { text: "" });

  const root = h(
    "div",
    { className: "lcd" },
    h("span", {}, h("span", { className: "dim", text: "tool" }), " ", toolEl),
    h(
      "span",
      { className: "pos" },
      h("span", { className: "dim", text: "x" }),
      " ",
      xEl,
      " ",
      h("span", { className: "dim", text: "y" }),
      " ",
      yEl,
    ),
    h("span", {}, h("span", { className: "dim", text: "mode" }), " ", modeEl),
    h("span", {}, h("span", { className: "dim", text: "cell" }), " ", cellEl),
    h(
      "span",
      { className: "grow" },
      tipEl,
      " ",
      h("i", { className: "cursor", attrs: { "aria-hidden": "true" } }),
    ),
  );

  return {
    root,
    sync(s) {
      toolEl.textContent = s.tool;
      xEl.textContent = s.hover ? pad3(s.hover.x) : "—";
      yEl.textContent = s.hover ? pad3(s.hover.y) : "—";
      modeEl.textContent = s.mode;
      cellEl.textContent = pad3(s.cellSize);
      tipEl.textContent = s.tip;
    },
  };
}

/** Charcoal status strip: tool, x/y, mode, cell, tip, blinking cursor. */

import { h } from "./dom";

export interface LcdState {
  tool: string;
  /** the active tool is a shape tool set to draw filled */
  filled: boolean;
  hover: { x: number; y: number } | null;
  mode: string;
  cellSize: number;
  focus: { cx: number; cy: number } | null;
  /** exported image size in pixels (square); orange once it's been upscaled */
  out: { size: number; scaled: boolean };
  /** marked region (or the floating paste's bounds), or null */
  sel: { w: number; h: number; floating: boolean } | null;
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
  // out value: plain at 1×, orange once the export is upscaled
  const outOffEl = h("span", { text: "" });
  const outOnEl = h("b", { text: "" });
  outOnEl.style.display = "none";
  // focus value: plain "—" when off, orange live value when focused
  const focusOffEl = h("span", { text: "—" });
  const focusOnEl = h("b", { text: "" });
  focusOnEl.style.display = "none";
  // sel value: plain "—" when nothing marked, orange live size when marked
  const selOffEl = h("span", { text: "—" });
  const selOnEl = h("b", { text: "" });
  selOnEl.style.display = "none";
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
    h("span", {}, h("span", { className: "dim", text: "out" }), " ", outOffEl, outOnEl),
    h("span", {}, h("span", { className: "dim", text: "focus" }), " ", focusOffEl, focusOnEl),
    h("span", {}, h("span", { className: "dim", text: "sel" }), " ", selOffEl, selOnEl),
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
      // the word only appears in the non-default state — state, not decoration
      toolEl.textContent = s.filled ? `${s.tool} filled` : s.tool;
      xEl.textContent = s.hover ? pad3(s.hover.x) : "—";
      yEl.textContent = s.hover ? pad3(s.hover.y) : "—";
      modeEl.textContent = s.mode;
      cellEl.textContent = pad3(s.cellSize);
      const out = `${pad3(s.out.size)}×${pad3(s.out.size)}`;
      if (s.out.scaled) {
        outOnEl.textContent = out;
        outOnEl.style.display = "";
        outOffEl.style.display = "none";
      } else {
        outOffEl.textContent = out;
        outOffEl.style.display = "";
        outOnEl.style.display = "none";
      }
      if (s.focus) {
        focusOnEl.textContent = `${s.focus.cx + 1}·${s.focus.cy + 1}`;
        focusOnEl.style.display = "";
        focusOffEl.style.display = "none";
      } else {
        focusOnEl.style.display = "none";
        focusOffEl.style.display = "";
      }
      if (s.sel) {
        selOnEl.textContent = `${s.sel.w}×${s.sel.h}`;
        selOnEl.style.display = "";
        selOffEl.style.display = "none";
      } else {
        selOnEl.style.display = "none";
        selOffEl.style.display = "";
      }
      tipEl.textContent = s.tip;
    },
  };
}

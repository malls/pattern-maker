/** pattern maker PM–1 — boot. Phase 1: static device shell, dead controls. */

import "./styles/tokens.css";
import "./styles/app.css";

import { h } from "./ui/dom";
import { createToolbar } from "./ui/toolbar";
import { createChips } from "./ui/chips";
import { createTransport } from "./ui/transport";
import { createLcd } from "./ui/lcd";

const TOOL_SPECS = [
  { id: "pencil", hotkey: "p", label: "pencil" },
  { id: "eraser", hotkey: "e", label: "eraser" },
  { id: "line", hotkey: "l", label: "line" },
  { id: "rect", hotkey: "r", label: "rect" },
  { id: "ellipse", hotkey: "o", label: "ellipse" },
  { id: "fill", hotkey: "f", label: "fill" },
  { id: "eyedropper", hotkey: "i", label: "eyedropper" },
] as const;

function boot(): void {
  const mount = document.getElementById("app");
  if (!mount) return;

  const toolbar = createToolbar({
    tools: TOOL_SPECS,
    handlers: {
      onTool: () => {},
      onMode: () => {},
      onCellStep: () => {},
    },
  });

  const chips = createChips(() => {});
  const transport = createTransport(() => {});
  const lcd = createLcd();

  const canvas = h("canvas", {
    className: "editor-canvas",
    attrs: { "aria-label": "drawing canvas", width: "48", height: "48" },
  });
  const bezel = h("div", { className: "bezel" }, canvas);
  const output = h(
    "div",
    { className: "output" },
    h("span", { className: "tb-label", text: "output" }),
  );
  const panel = h("div", { className: "panel" }, bezel, output);

  const deck = h("div", { className: "deck" }, chips.root, transport.root);

  const device = h(
    "div",
    { className: "device", attrs: { role: "application", "aria-label": "pattern maker PM–1" } },
    h("div", { className: "screw tl", attrs: { "aria-hidden": "true" } }),
    h("div", { className: "screw tr", attrs: { "aria-hidden": "true" } }),
    h("div", { className: "screw bl", attrs: { "aria-hidden": "true" } }),
    h("div", { className: "screw br", attrs: { "aria-hidden": "true" } }),
    h(
      "header",
      { className: "masthead" },
      h("span", { className: "wordmark", text: "pattern maker" }),
      h("span", { className: "model", text: "PM–1" }),
      h("span", { className: "tagline", text: "professional pattern instrument" }),
      h("span", { className: "power", title: "on", attrs: { "aria-hidden": "true" } }),
    ),
    toolbar.root,
    panel,
    deck,
    lcd.root,
  );

  mount.append(device);

  toolbar.sync({ tool: "pencil", mode: "border", cellSize: 16 });
  chips.sync("#232320");
  lcd.sync({
    tool: "pencil",
    hover: null,
    mode: "border",
    cellSize: 16,
    tip: "warming up",
  });
}

boot();

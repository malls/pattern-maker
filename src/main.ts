/** pattern maker PM–1 — boot: build DOM, create store + doc, wire everything.
 *  Phase 2: border-mode editor live with pencil + eraser. */

import "./styles/tokens.css";
import "./styles/app.css";

import { hexToU32 } from "./raster/buffer";
import { createDoc } from "./state/doc";
import type { AppState } from "./state/store";
import { createStore } from "./state/store";
import { createGridEditor } from "./editor/grid-editor";
import { TOOLS, toolById } from "./tools/index";
import { h } from "./ui/dom";
import { createToolbar } from "./ui/toolbar";
import { createChips } from "./ui/chips";
import { createTransport } from "./ui/transport";
import { createLcd } from "./ui/lcd";

const DEFAULT_COLOR = "#232320";
const DEFAULT_CELL = 16;

const MODE_TIPS: Record<string, string> = {
  border: "center stays empty. css says so",
  tile: "draws on all nine. that's the point",
};

function boot(): void {
  const mount = document.getElementById("app");
  if (!mount) return;

  const doc = createDoc(DEFAULT_CELL);
  const store = createStore<AppState>({
    mode: "border",
    tool: "pencil",
    color: hexToU32(DEFAULT_COLOR) ?? 0xff000000,
    colorHex: DEFAULT_COLOR,
    cellSize: DEFAULT_CELL,
    hover: null,
    dirtyDoc: 0,
    dirtyPreview: 0,
    tip: MODE_TIPS["border"] ?? "",
  });

  // ── actions ────────────────────────────────────────────────────────
  function setTool(id: string): void {
    const t = toolById(id);
    store.set({ tool: t.id, tip: t.tip });
  }

  function setColorHex(hex: string): void {
    const c = hexToU32(hex);
    if (c === null) return;
    store.set({ color: c, colorHex: hex });
  }

  // ── build the device ───────────────────────────────────────────────
  const toolbar = createToolbar({
    tools: TOOLS.map((t) => ({ id: t.id, hotkey: t.hotkey, label: t.label })),
    handlers: {
      onTool: setTool,
      onMode: () => {},
      onCellStep: () => {},
    },
  });

  const chips = createChips(setColorHex);
  const transport = createTransport(() => {});
  const lcd = createLcd();

  const canvas = h("canvas", {
    className: "editor-canvas",
    attrs: { "aria-label": "drawing canvas" },
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

  // ── editor ─────────────────────────────────────────────────────────
  createGridEditor({
    canvas,
    container: bezel,
    store,
    doc,
    getTool: () => toolById(store.get().tool),
    beginStroke: () => {},
    commit: () => {},
  });

  // ── reflect state into the chrome ──────────────────────────────────
  function syncAll(s: AppState): void {
    toolbar.sync({ tool: s.tool, mode: s.mode, cellSize: s.cellSize });
    chips.sync(s.colorHex);
    lcd.sync({ tool: s.tool, hover: s.hover, mode: s.mode, cellSize: s.cellSize, tip: s.tip });
  }
  store.subscribe((s) => syncAll(s));
  syncAll(store.get());
}

boot();

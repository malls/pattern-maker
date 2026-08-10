/** pattern maker PM–1 — boot: build DOM, create store + doc, wire everything. */

import "./styles/tokens.css";
import "./styles/app.css";

import { hexToU32 } from "./raster/buffer";
import { clearMode, createDoc } from "./state/doc";
import * as history from "./state/history";
import type { AppState } from "./state/store";
import { createStore } from "./state/store";
import { createGridEditor } from "./editor/grid-editor";
import { TOOLS, toolByHotkey, toolById } from "./tools/index";
import type { TransportAction } from "./ui/transport";
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
  const hist = history.createHistories();
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
  function bumpDoc(patch: Partial<AppState> = {}): void {
    const s = store.get();
    store.set({ ...patch, dirtyDoc: s.dirtyDoc + 1, dirtyPreview: s.dirtyPreview + 1 });
  }

  function setTool(id: string): void {
    const t = toolById(id);
    store.set({ tool: t.id, tip: t.tip });
  }

  function setColorHex(hex: string): void {
    const c = hexToU32(hex);
    if (c === null) return;
    store.set({ color: c, colorHex: hex });
  }

  function setMode(mode: string): void {
    if (mode !== "border" && mode !== "tile") return;
    const s = store.get();
    if (s.mode === mode) return;
    store.set({
      mode,
      hover: null,
      tip: MODE_TIPS[mode] ?? "",
      dirtyPreview: s.dirtyPreview + 1,
    });
  }

  function doUndo(): void {
    const s = store.get();
    if (history.undo(hist, doc, s.mode)) {
      bumpDoc({ cellSize: doc.cellSize, tip: "undone" });
    } else {
      store.set({ tip: "nothing to undo" });
    }
  }

  function doRedo(): void {
    const s = store.get();
    if (history.redo(hist, doc, s.mode)) {
      bumpDoc({ cellSize: doc.cellSize, tip: "redone" });
    } else {
      store.set({ tip: "nothing to redo" });
    }
  }

  function doClear(): void {
    const s = store.get();
    history.push(hist, doc, s.mode);
    clearMode(doc, s.mode);
    bumpDoc({ tip: "cleared. fresh start" });
  }

  function onTransport(action: TransportAction): void {
    switch (action) {
      case "undo":
        doUndo();
        break;
      case "redo":
        doRedo();
        break;
      case "clear":
        doClear();
        break;
      default:
        break;
    }
  }

  // ── build the device ───────────────────────────────────────────────
  const toolbar = createToolbar({
    tools: TOOLS.map((t) => ({ id: t.id, hotkey: t.hotkey, label: t.label })),
    handlers: {
      onTool: setTool,
      onMode: setMode,
      onCellStep: () => {},
    },
  });

  const chips = createChips(setColorHex);
  const transport = createTransport(onTransport);
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
    beginStroke: () => history.push(hist, doc, store.get().mode),
    commit: () => store.set({ dirtyPreview: store.get().dirtyPreview + 1 }),
  });

  // ── keyboard ───────────────────────────────────────────────────────
  window.addEventListener("keydown", (e) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
      return;
    }
    const key = e.key.toLowerCase();
    if (e.ctrlKey || e.metaKey) {
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) doRedo();
        else doUndo();
      } else if (key === "y") {
        e.preventDefault();
        doRedo();
      }
      return;
    }
    if (e.altKey) return;
    if (key === "1") {
      setMode("border");
      return;
    }
    if (key === "2") {
      setMode("tile");
      return;
    }
    const tool = toolByHotkey(key);
    if (tool) setTool(tool.id);
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

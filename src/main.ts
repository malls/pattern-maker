/** pattern maker PM–1 — boot: build DOM, create store + doc, wire everything. */

import "./styles/tokens.css";
import "./styles/app.css";

import { hexToU32 } from "./raster/buffer";
import { line, rectOutline } from "./raster/raster";
import type { Doc } from "./state/doc";
import { CELL_SIZES, clearMode, createDoc, plotBorder, setCellSize, viewSize } from "./state/doc";
import * as history from "./state/history";
import type { AppState } from "./state/store";
import { createStore } from "./state/store";
import { activeBuffer } from "./state/doc";
import type { DecodedProject } from "./state/persist";
import { autosave, downloadProject, loadAutosave, pickAndImportProject } from "./state/persist";
import { createGridEditor } from "./editor/grid-editor";
import { bufferToDataURI, debounce } from "./preview/compose";
import { createBorderPreview } from "./preview/border-preview";
import { createTilePreview } from "./preview/tile-preview";
import { borderCSS, copyText, tileCSS } from "./export/css";
import { downloadPNG } from "./export/png";
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

/** A small considered mark so the first canvas isn't scary-blank: an ink
 *  frame, orange corner blocks, and orange edge ticks (which make the four
 *  border-image repeat variants visibly differ right away). */
function welcomeMark(doc: Doc): void {
  const ink = hexToU32("#232320") ?? 0xff000000;
  const orange = hexToU32("#FF4E00") ?? 0xff000000;
  const L = viewSize(doc);
  const plotInk = (x: number, y: number): void => plotBorder(doc, x, y, ink);
  rectOutline(0, 0, L - 1, L - 1, plotInk);
  rectOutline(2, 2, L - 3, L - 3, plotInk);

  const block = (x0: number, y0: number, c: number): void => {
    for (let y = y0; y < y0 + 3; y++) {
      for (let x = x0; x < x0 + 3; x++) plotBorder(doc, x, y, c);
    }
  };
  block(4, 4, orange);
  block(L - 7, 4, orange);
  block(4, L - 7, orange);
  block(L - 7, L - 7, orange);

  const m = Math.floor(L / 2) - 1;
  const plotOrange = (x: number, y: number): void => plotBorder(doc, x, y, orange);
  line(m, 4, m + 1, 4, plotOrange);
  line(m, L - 5, m + 1, L - 5, plotOrange);
  line(4, m, 4, m + 1, plotOrange);
  line(L - 5, m, L - 5, m + 1, plotOrange);
}

function boot(): void {
  const mount = document.getElementById("app");
  if (!mount) return;

  const restored = loadAutosave();
  const doc = restored ? restored.doc : createDoc(DEFAULT_CELL);
  if (!restored) welcomeMark(doc);
  const startMode = restored ? restored.mode : "border";
  const startColor = restored ? restored.colorHex : DEFAULT_COLOR;
  const hist = history.createHistories();
  const store = createStore<AppState>({
    mode: startMode,
    tool: "pencil",
    color: hexToU32(startColor) ?? 0xff000000,
    colorHex: startColor,
    cellSize: doc.cellSize,
    focus: null,
    hover: null,
    dirtyDoc: 0,
    dirtyPreview: 0,
    tip: restored ? "picked up where you left off" : (MODE_TIPS[startMode] ?? ""),
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
      focus: null, // mode switch always exits focus
      hover: null,
      tip: MODE_TIPS[mode] ?? "",
      dirtyPreview: s.dirtyPreview + 1,
    });
  }

  // ── zoom-to-one-cell focus (ephemeral view state, never persisted) ──
  let lastFocus = { cx: 0, cy: 0 };

  function enterFocus(cx: number, cy: number): void {
    const s = store.get();
    if (s.mode === "border" && cx === 1 && cy === 1) {
      store.set({ tip: "center's locked. pick a live cell" });
      return;
    }
    lastFocus = { cx, cy };
    store.set({
      focus: { cx, cy },
      hover: null,
      tip: s.mode === "border" ? "one cell. all the pixels" : "one tile. it still wraps",
    });
  }

  function exitFocus(): void {
    if (!store.get().focus) return;
    store.set({ focus: null, hover: null, tip: "back to nine" });
  }

  function toggleFocus(): void {
    const s = store.get();
    if (s.focus) {
      exitFocus();
      return;
    }
    let { cx, cy } = lastFocus;
    if (s.hover) {
      cx = Math.max(0, Math.min(2, Math.floor(s.hover.x / doc.cellSize)));
      cy = Math.max(0, Math.min(2, Math.floor(s.hover.y / doc.cellSize)));
    } else if (s.mode === "border" && cx === 1 && cy === 1) {
      // remembered cell can be the center when it was focused in tile mode
      cx = 0;
      cy = 0;
    }
    enterFocus(cx, cy);
  }

  function moveFocus(dx: number, dy: number): void {
    const s = store.get();
    if (!s.focus) return;
    let cx = s.focus.cx + dx;
    let cy = s.focus.cy + dy;
    if (cx < 0 || cx > 2 || cy < 0 || cy > 2) return; // no wrap-around
    if (s.mode === "border" && cx === 1 && cy === 1) {
      // step over the locked center in the same direction
      cx += dx;
      cy += dy;
      if (cx < 0 || cx > 2 || cy < 0 || cy > 2) return;
    }
    lastFocus = { cx, cy };
    store.set({ focus: { cx, cy }, hover: null });
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

  function stepCell(dir: -1 | 1): void {
    const cur = doc.cellSize;
    const next =
      dir === 1
        ? (CELL_SIZES.find((v) => v > cur) ?? cur)
        : ([...CELL_SIZES].reverse().find((v) => v < cur) ?? cur);
    if (next === cur) {
      store.set({ tip: dir === 1 ? "that's as big as cells get" : "that's as small as cells get" });
      return;
    }
    history.pushBoth(hist, doc);
    setCellSize(doc, next);
    bumpDoc({ cellSize: next, tip: `cell ${String(next).padStart(3, "0")}` });
  }

  function doSave(): void {
    const s = store.get();
    downloadProject(doc, s.mode, s.colorHex);
    store.set({ tip: "pattern.json" });
  }

  function applyProject(p: DecodedProject): void {
    // make loading undoable in both modes, then swap the doc contents in place
    history.pushBoth(hist, doc);
    doc.cellSize = p.doc.cellSize;
    doc.border = p.doc.border;
    doc.tile = p.doc.tile;
    bumpDoc({
      mode: p.mode,
      cellSize: doc.cellSize,
      color: hexToU32(p.colorHex) ?? store.get().color,
      colorHex: p.colorHex,
      hover: null,
      tip: "project loaded",
    });
  }

  function doLoad(): void {
    pickAndImportProject((p) => {
      if (!p) {
        store.set({ tip: "couldn't read that file" });
        return;
      }
      applyProject(p);
    });
  }

  function doCopyCss(): void {
    const s = store.get();
    const uri = bufferToDataURI(activeBuffer(doc, s.mode));
    const snippet = s.mode === "border" ? borderCSS(uri, doc.cellSize) : tileCSS(uri, doc.cellSize);
    void copyText(snippet).then((ok) => {
      store.set({ tip: ok ? "css copied" : "couldn't reach the clipboard" });
    });
  }

  function doExportPng(): void {
    const s = store.get();
    downloadPNG(activeBuffer(doc, s.mode));
    store.set({ tip: "pattern.png" });
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
      case "save":
        doSave();
        break;
      case "load":
        doLoad();
        break;
      case "css":
        doCopyCss();
        break;
      case "export":
        doExportPng();
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
      onCellStep: stepCell,
      onFocus: toggleFocus,
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
  const borderPreview = createBorderPreview();
  const tilePreview = createTilePreview();
  const output = h(
    "div",
    { className: "output" },
    h("span", { className: "tb-label", text: "output" }),
    borderPreview.root,
    tilePreview.root,
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
    if (key === "escape") {
      if (store.get().focus) exitFocus(); // don't swallow Esc otherwise
      return;
    }
    if (store.get().focus && key.startsWith("arrow")) {
      e.preventDefault();
      if (key === "arrowleft") moveFocus(-1, 0);
      else if (key === "arrowright") moveFocus(1, 0);
      else if (key === "arrowup") moveFocus(0, -1);
      else if (key === "arrowdown") moveFocus(0, 1);
      return;
    }
    if (key === "z") {
      toggleFocus();
      return;
    }
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

  // ── live previews (150 ms debounce while drawing; instant on commit) ─
  function refreshPreviews(): void {
    const s = store.get();
    const uri = bufferToDataURI(activeBuffer(doc, s.mode));
    if (s.mode === "border") {
      borderPreview.update(uri, doc.cellSize);
      borderPreview.root.style.display = "";
      tilePreview.root.style.display = "none";
    } else {
      tilePreview.update(uri, doc.cellSize);
      tilePreview.root.style.display = "";
      borderPreview.root.style.display = "none";
    }
  }
  const debouncedPreviews = debounce(150, refreshPreviews);
  store.subscribe((s, prev) => {
    if (s.dirtyPreview !== prev.dirtyPreview || s.mode !== prev.mode) {
      debouncedPreviews.now();
    } else if (s.dirtyDoc !== prev.dirtyDoc) {
      debouncedPreviews();
    }
  });
  refreshPreviews();

  // ── autosave (~500 ms after changes settle) ────────────────────────
  const debouncedAutosave = debounce(500, () => {
    const s = store.get();
    autosave(doc, s.mode, s.colorHex);
  });
  store.subscribe((s, prev) => {
    if (
      s.dirtyDoc !== prev.dirtyDoc ||
      s.dirtyPreview !== prev.dirtyPreview ||
      s.mode !== prev.mode ||
      s.colorHex !== prev.colorHex
    ) {
      debouncedAutosave();
    }
  });

  // ── reflect state into the chrome ──────────────────────────────────
  function syncAll(s: AppState): void {
    toolbar.sync({ tool: s.tool, mode: s.mode, cellSize: s.cellSize, focus: s.focus !== null });
    chips.sync(s.colorHex);
    lcd.sync({
      tool: s.tool,
      hover: s.hover,
      mode: s.mode,
      cellSize: s.cellSize,
      focus: s.focus,
      tip: s.tip,
    });
  }
  store.subscribe((s) => syncAll(s));
  syncAll(store.get());
}

boot();

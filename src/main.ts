/** pattern maker PM–1 — boot: build DOM, create store + doc, wire everything. */

import "./styles/tokens.css";
import "./styles/app.css";

import type { PixelBuffer } from "./raster/buffer";
import { clone, hexToU32, scaleUp } from "./raster/buffer";
import { line, rectOutline } from "./raster/raster";
import type { Doc } from "./state/doc";
import { clampCell, clearMode, createDoc, plotBorder, setCellSize, viewSize } from "./state/doc";
import * as history from "./state/history";
import {
  clampFloatPos,
  copyRect,
  createSelection,
  cropTopLeft,
  eraseRect,
  stampFloat,
} from "./state/selection";
import type { AppState } from "./state/store";
import { createStore } from "./state/store";
import { DEFAULT_PALETTE, PALETTES, paletteById } from "./state/palettes";
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
/** the only export upscales offered — two keys, three values, no wrap */
const EXPORT_SCALES = [1, 2, 4] as const;

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
    palette: restored ? restored.palette : DEFAULT_PALETTE,
    focus: null,
    hover: null,
    exportScale: 1, // session-only: a restored project never dictates it
    shapeFill: { rect: false, ellipse: false }, // outline is the default
    dirtyDoc: 0,
    dirtyPreview: 0,
    dirtySel: 0,
    tip: restored ? "picked up where you left off" : (MODE_TIPS[startMode] ?? ""),
  });

  // ── selection (ephemeral view state — never persisted, never in history) ──
  const sel = createSelection();
  /** in-memory clipboard: survives mode / cell-size / focus changes, is never
   *  persisted, and never touches the system clipboard */
  let clipboard: PixelBuffer | null = null;

  // ── actions ────────────────────────────────────────────────────────
  function bumpDoc(patch: Partial<AppState> = {}): void {
    const s = store.get();
    store.set({ ...patch, dirtyDoc: s.dirtyDoc + 1, dirtyPreview: s.dirtyPreview + 1 });
  }

  /** Selection changes re-render the editor only — no previews, no autosave. */
  function bumpSel(patch: Partial<AppState> = {}): void {
    store.set({ ...patch, dirtySel: store.get().dirtySel + 1 });
  }

  function deselect(): void {
    if (!sel.rect) return;
    sel.rect = null;
    bumpSel({ tip: "deselected" });
  }

  /** Drop the marked rect silently (the window or the document changed under
   *  it). Returns the dirtySel patch so callers can fold it into one set. */
  function clearSelectionPatch(): Partial<AppState> {
    sel.rect = null;
    return { dirtySel: store.get().dirtySel + 1 };
  }

  function copySel(): void {
    const r = sel.rect;
    if (!r) {
      store.set({ tip: "nothing selected. m marks" });
      return;
    }
    clipboard = copyRect(doc, store.get().mode, r);
    store.set({ tip: `copied ${r.w}×${r.h}` });
  }

  /** copy + erase, one undo entry; the selection survives the cut */
  function cutSel(): void {
    const r = sel.rect;
    if (!r) {
      store.set({ tip: "nothing selected. m marks" });
      return;
    }
    const s = store.get();
    clipboard = copyRect(doc, s.mode, r);
    history.push(hist, doc, s.mode);
    eraseRect(doc, s.mode, r);
    bumpDoc({ tip: `cut ${r.w}×${r.h}` });
  }

  /** erase without touching the clipboard */
  function deleteSel(): void {
    const r = sel.rect;
    if (!r) return;
    const s = store.get();
    history.push(hist, doc, s.mode);
    eraseRect(doc, s.mode, r);
    bumpDoc({ tip: "erased" });
  }

  /** The visible window in view coordinates (the focused cell, or the view). */
  function windowBox(): { x0: number; y0: number; size: number } {
    const f = store.get().focus;
    const C = doc.cellSize;
    return f
      ? { x0: f.cx * C, y0: f.cy * C, size: C }
      : { x0: 0, y0: 0, size: viewSize(doc) };
  }

  /** Paste: the clipboard starts floating, centred in the current window. */
  function pasteClip(): void {
    const clip = clipboard;
    if (!clip) {
      store.set({ tip: "nothing to paste" });
      return;
    }
    if (sel.float) stampFloatAction(); // a second paste commits the first
    const L = viewSize(doc);
    const buf = cropTopLeft(clip, Math.min(clip.w, L), Math.min(clip.h, L));
    const focus = store.get().focus;
    let didntFit = false;
    if (focus && (buf.w > doc.cellSize || buf.h > doc.cellSize)) {
      exitFocus(); // doesn't fit the cell — paste into the full view instead
      didntFit = true;
    }
    setTool("select"); // paste always hands you the tool that moves it
    const win = windowBox();
    const f = {
      buf: clone(buf),
      x: win.x0 + Math.floor((win.size - buf.w) / 2),
      y: win.y0 + Math.floor((win.size - buf.h) / 2),
    };
    const p = clampFloatPos(f, win.x0, win.y0, win.size, win.size);
    f.x = p.x;
    f.y = p.y;
    sel.float = f;
    sel.rect = null;
    // the exit-focus tip wins when it fired — it explains a window change the
    // "floating" tip would otherwise swallow (both are set in one turn)
    bumpSel({ tip: didntFit ? "back to nine. it didn't fit" : "floating. drag it. enter stamps" });
  }

  /** Commit the float into the doc — one undo entry; the stamped bounds stay
   *  selected so an immediate re-copy / re-cut works. */
  function stampFloatAction(): void {
    const f = sel.float;
    if (!f) return;
    const s = store.get();
    history.push(hist, doc, s.mode);
    stampFloat(doc, s.mode, f);
    sel.float = null;
    sel.rect = { x: f.x, y: f.y, w: f.buf.w, h: f.buf.h };
    bumpDoc({ dirtySel: s.dirtySel + 1, tip: "stamped" });
  }

  /** Drop the float without touching the doc (the clipboard survives). */
  function cancelFloat(): void {
    if (!sel.float) return;
    sel.float = null;
    sel.rect = null;
    bumpSel({ tip: "paste dropped" });
  }

  function nudgeFloat(dx: number, dy: number): void {
    const f = sel.float;
    if (!f) return;
    const win = windowBox();
    const p = clampFloatPos(
      { buf: f.buf, x: f.x + dx, y: f.y + dy },
      win.x0,
      win.y0,
      win.size,
      win.size,
    );
    if (p.x === f.x && p.y === f.y) return;
    f.x = p.x;
    f.y = p.y;
    bumpSel();
  }

  /** Anything that changes what's under the float commits it first. */
  function commitFloatFirst(): void {
    if (sel.float) stampFloatAction();
  }

  /** Load / clear replace the document — stamping into it would be noise. */
  function dropSelection(): Partial<AppState> {
    sel.float = null;
    return clearSelectionPatch();
  }

  /** Re-selecting an already-active shape tool flips it between outline and
   *  filled. Plain store.set: the flag changes neither the document nor the
   *  previews, so it must bump neither dirtyDoc nor dirtyPreview — no preview
   *  regeneration, no autosave churn, no undo entry. */
  function toggleShapeFill(id: string): void {
    const s = store.get();
    const next = !s.shapeFill[id];
    store.set({
      shapeFill: { ...s.shapeFill, [id]: next },
      tip: next ? "filled. click again for outline" : "outline. click again for filled",
    });
  }

  function setTool(id: string): void {
    const t = toolById(id);
    if (store.get().tool === t.id) {
      if (t.fillable) toggleShapeFill(t.id);
      else store.set({ tip: t.tip });
      return;
    }
    commitFloatFirst();
    const patch = t.id === "select" ? {} : clearSelectionPatch();
    store.set({ ...patch, tool: t.id, tip: t.tip });
  }

  function setColorHex(hex: string): void {
    const c = hexToU32(hex);
    if (c === null) return;
    store.set({ color: c, colorHex: hex });
  }

  function setMode(mode: string): void {
    if (mode !== "border" && mode !== "tile") return;
    const s0 = store.get();
    if (s0.mode === mode) return;
    commitFloatFirst(); // stamps into the outgoing mode
    const s = store.get();
    store.set({
      ...clearSelectionPatch(),
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
    commitFloatFirst(); // the window is about to change under the float
    lastFocus = { cx, cy };
    store.set({
      ...clearSelectionPatch(),
      focus: { cx, cy },
      hover: null,
      tip: s.mode === "border" ? "one cell. all the pixels" : "one tile. it still wraps",
    });
  }

  function exitFocus(): void {
    if (!store.get().focus) return;
    commitFloatFirst();
    store.set({ ...clearSelectionPatch(), focus: null, hover: null, tip: "back to nine" });
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
    commitFloatFirst();
    lastFocus = { cx, cy };
    store.set({ ...clearSelectionPatch(), focus: { cx, cy }, hover: null });
  }

  function doUndo(): void {
    // the float never entered the doc — "undo the paste" is just dropping it
    if (sel.float) {
      cancelFloat();
      return;
    }
    const s = store.get();
    if (history.undo(hist, doc, s.mode)) {
      bumpDoc({ cellSize: doc.cellSize, tip: "undone" });
    } else {
      store.set({ tip: "nothing to undo" });
    }
  }

  function doRedo(): void {
    if (sel.float) {
      cancelFloat();
      return;
    }
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
    bumpDoc({ ...dropSelection(), tip: "cleared. fresh start" });
  }

  function setCell(raw: number, atLimitTip?: string): void {
    const cur = doc.cellSize;
    const next = clampCell(raw);
    if (next === cur) {
      store.set({ tip: atLimitTip ?? `cell ${String(cur).padStart(3, "0")} already` });
      return;
    }
    commitFloatFirst(); // float coords are in the CURRENT cell size — stamp
    history.pushBoth(hist, doc); //  before the resample, never after
    setCellSize(doc, next);
    bumpDoc({
      ...clearSelectionPatch(),
      cellSize: next,
      tip: `cell ${String(next).padStart(3, "0")}`,
    });
  }

  function stepCell(delta: number): void {
    setCell(
      doc.cellSize + delta,
      delta > 0 ? "that's as big as cells get" : "that's as small as cells get",
    );
  }

  /** Move through {1,2,4}. Plain store.set on purpose: the scale changes
   *  neither the document nor the previews, so it must bump neither
   *  dirtyDoc nor dirtyPreview — no preview regeneration, no autosave churn. */
  function stepScale(delta: number): void {
    const s = store.get();
    const i = EXPORT_SCALES.indexOf(s.exportScale);
    const j = Math.min(EXPORT_SCALES.length - 1, Math.max(0, i + delta));
    const next = EXPORT_SCALES[j] ?? 1;
    if (next === s.exportScale) {
      store.set({
        tip: delta > 0 ? "that's as big as exports get" : "that's as small as exports get",
      });
      return;
    }
    store.set({ exportScale: next, tip: `scale ${next}×` });
  }

  /** Move through PALETTES, wrapping. Plain store.set on purpose: the palette
   *  changes neither the document nor the previews, so it must bump neither
   *  dirtyDoc nor dirtyPreview — no preview regeneration, no history entry.
   *  It IS persisted, so the autosave subscriber watches s.palette.
   *
   *  Wraps rather than clamps: cells and export scales have ends ("that's as
   *  big as cells get"), a set of schemes doesn't — it's a rotary selector,
   *  not a fader. So there is no at-the-limit tip to print. */
  function stepPalette(delta: number): void {
    const s = store.get();
    const n = PALETTES.length;
    const i = PALETTES.findIndex((p) => p.id === s.palette);
    const j = (((i < 0 ? 0 : i) + delta) % n + n) % n;
    const next = PALETTES[j] ?? PALETTES[0];
    if (!next) return;
    store.set({ palette: next.id, tip: next.tip });
  }

  function doSave(): void {
    commitFloatFirst(); // an explicit save writes what's on screen
    const s = store.get();
    downloadProject(doc, s.mode, s.colorHex, s.palette);
    store.set({ tip: "pattern.json" });
  }

  function applyProject(p: DecodedProject): void {
    // make loading undoable in both modes, then swap the doc contents in place
    history.pushBoth(hist, doc);
    doc.cellSize = p.doc.cellSize;
    doc.border = p.doc.border;
    doc.tile = p.doc.tile;
    bumpDoc({
      ...dropSelection(),
      mode: p.mode,
      cellSize: doc.cellSize,
      color: hexToU32(p.colorHex) ?? store.get().color,
      colorHex: p.colorHex,
      palette: p.palette,
      focus: null, // loading swaps mode/doc under the view — never keep focus
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

  /** Side of the square the export/copy would write: the 3C×3C border sheet or
   *  the C×C tile, times the export scale. */
  function outputSize(s: AppState): number {
    return (s.mode === "border" ? 3 : 1) * doc.cellSize * s.exportScale;
  }

  function doCopyCss(): void {
    commitFloatFirst(); // the snippet must describe what's on screen
    const s = store.get();
    // the snippet describes the image it embeds, so both come from the same
    // upscaled buffer: the slice is in image pixels and must scale with it
    const scale = s.exportScale;
    const unit = doc.cellSize * scale;
    const uri = bufferToDataURI(scaleUp(activeBuffer(doc, s.mode), scale));
    const snippet = s.mode === "border" ? borderCSS(uri, unit) : tileCSS(uri, unit);
    void copyText(snippet).then((ok) => {
      store.set({
        tip: ok
          ? scale === 1
            ? "css copied"
            : `css copied ${scale}×`
          : "couldn't reach the clipboard",
      });
    });
  }

  function doExportPng(): void {
    commitFloatFirst(); // an explicit export writes what's on screen
    const s = store.get();
    const scale = s.exportScale;
    downloadPNG(activeBuffer(doc, s.mode), scale);
    store.set({ tip: scale === 1 ? "pattern.png" : `pattern.png ${scale}×` });
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
    tools: TOOLS.map((t) => ({
      id: t.id,
      hotkey: t.hotkey,
      label: t.label,
      fillable: t.fillable === true,
    })),
    handlers: {
      onTool: setTool,
      onMode: setMode,
      onCellStep: stepCell,
      onCellSet: setCell,
      onFocus: toggleFocus,
    },
  });

  const chips = createChips({ onColor: setColorHex, onPaletteStep: stepPalette });
  const transport = createTransport({ onAction: onTransport, onScaleStep: stepScale });
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
      // the desktop app doesn't advertise itself
      ...("__TAURI_INTERNALS__" in window
        ? []
        : [
            h("a", {
              className: "download",
              text: "desktop ↓",
              attrs: {
                href: "https://github.com/malls/pattern-maker/releases/latest",
                target: "_blank",
                rel: "noopener",
              },
            }),
          ]),
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
    sel,
    getTool: () => toolById(store.get().tool),
    stampFloat: () => stampFloatAction(),
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
      } else if (key === "c") {
        if (sel.rect) e.preventDefault();
        copySel();
      } else if (key === "x") {
        if (sel.rect) e.preventDefault();
        cutSel();
      } else if (key === "v") {
        if (clipboard) e.preventDefault();
        pasteClip();
      }
      return;
    }
    if (e.altKey) return;
    if (key === "escape") {
      // selection always wins over focus-exit; never swallowed when idle
      if (sel.float) cancelFloat();
      else if (sel.rect) deselect();
      else if (store.get().focus) exitFocus();
      return;
    }
    if (key === "enter" && sel.float) {
      e.preventDefault();
      stampFloatAction();
      return;
    }
    if (sel.float && key.startsWith("arrow")) {
      e.preventDefault();
      const d = e.shiftKey ? 8 : 1;
      if (key === "arrowleft") nudgeFloat(-d, 0);
      else if (key === "arrowright") nudgeFloat(d, 0);
      else if (key === "arrowup") nudgeFloat(0, -d);
      else if (key === "arrowdown") nudgeFloat(0, d);
      return;
    }
    if ((key === "delete" || key === "backspace") && sel.rect && !sel.float) {
      e.preventDefault();
      deleteSel();
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
    // brackets step the palette — the near-universal "through a set" binding,
    // and they cost no letter the tool roster still wants. Shift is already
    // the ±8 modifier elsewhere, so { and } stay out of it.
    if (key === "[") {
      stepPalette(-1);
      return;
    }
    if (key === "]") {
      stepPalette(1);
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
    if (tool) {
      if (e.repeat) return; // holding a tool key must not strobe the fill flag
      setTool(tool.id);
    }
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
    autosave(doc, s.mode, s.colorHex, s.palette);
  });
  store.subscribe((s, prev) => {
    if (
      s.dirtyDoc !== prev.dirtyDoc ||
      s.dirtyPreview !== prev.dirtyPreview ||
      s.mode !== prev.mode ||
      s.colorHex !== prev.colorHex ||
      s.palette !== prev.palette
    ) {
      debouncedAutosave();
    }
  });

  // ── reflect state into the chrome ──────────────────────────────────
  function syncAll(s: AppState): void {
    toolbar.sync({
      tool: s.tool,
      mode: s.mode,
      cellSize: s.cellSize,
      focus: s.focus !== null,
      shapeFill: s.shapeFill,
    });
    const p = paletteById(s.palette);
    chips.sync({ colorHex: s.colorHex, swatches: p.swatches, paletteLabel: p.label });
    transport.sync({ exportScale: s.exportScale });
    lcd.sync({
      tool: s.tool,
      filled: s.shapeFill[s.tool] === true,
      hover: s.hover,
      mode: s.mode,
      cellSize: s.cellSize,
      focus: s.focus,
      out: { size: outputSize(s), scaled: s.exportScale > 1 },
      sel: sel.float
        ? { w: sel.float.buf.w, h: sel.float.buf.h, floating: true }
        : sel.rect
          ? { w: sel.rect.w, h: sel.rect.h, floating: false }
          : null,
      tip: s.tip,
    });
  }
  store.subscribe((s) => syncAll(s));
  syncAll(store.get());
}

boot();

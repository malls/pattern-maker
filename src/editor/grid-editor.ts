/** The left canvas: crisp integer zoom, DPR handling, pointer→pixel mapping,
 *  render loop, and the ToolContext bridge between pointer gestures and the
 *  document.
 *
 *  Sizing model: the canvas always fills the bezel's inner box (a fixed
 *  footprint set in CSS); the art is drawn centered inside it at the largest
 *  integer device-pixel zoom that fits, letterboxed on the light well. Changing
 *  cell size changes resolution only, never the editor's on-screen size. */

import type { PixelBuffer } from "../raster/buffer";
import { alphaOf, u32ToHex } from "../raster/buffer";
import type { AppState, Store } from "../state/store";
import type { Doc } from "../state/doc";
import { activeBuffer, floodView, getViewPx, plotView, viewSize } from "../state/doc";
import type { SelectionState } from "../state/selection";
import type { Pt, Tool, ToolContext } from "../tools/types";
import {
  drawCenterLock,
  drawChecker,
  drawDelineation,
  drawFocusMinimap,
  drawMarquee,
} from "./chrome";

export interface GridEditorDeps {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  store: Store<AppState>;
  doc: Doc;
  /** live selection state, held by main and mutated in place (the doc pattern) */
  sel: SelectionState;
  getTool(): Tool;
  /** push an undo entry for the active mode (called at gesture start) */
  beginStroke(): void;
  /** gesture finished — regenerate previews / autosave */
  commit(): void;
}

export interface GridEditor {
  requestRender(): void;
  relayout(): void;
}

/** Container inner padding (the bezel's 8px) — subtracted when measuring. */
const BEZEL_PAD = 8;

function get2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  return ctx;
}

const clampN = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
const modN = (n: number, m: number): number => ((n % m) + m) % m;

export function createGridEditor(deps: GridEditorDeps): GridEditor {
  const { canvas, container, store, doc, sel } = deps;
  const ctx = get2d(canvas);

  // offscreen canvases
  const offNative = document.createElement("canvas"); // L×L composed view
  const offTile = document.createElement("canvas"); // C×C tile scratch
  const checker = document.createElement("canvas"); // device-scale cache
  const offNativeCtx = get2d(offNative);
  const offTileCtx = get2d(offTile);
  const checkerCtx = get2d(checker);

  // ── the art rect (single source of truth for layout() and toPt()) ──
  // Canvas backing store is devW×devH device px; the art occupies the
  // square [ox, ox+Lf·z) × [oy, oy+Lf·z), where Lf is the logical size
  // shown (whole view L today; one cell C when focused) and (fx0, fy0)
  // is the logical origin of that window in view coordinates.
  let z = 1;
  let dpr = window.devicePixelRatio || 1;
  let devW = 0;
  let devH = 0;
  let ox = 0;
  let oy = 0;
  let Lf = 0;
  let fx0 = 0;
  let fy0 = 0;
  let laidOutL = 0;
  let needLayout = true;
  let renderQueued = false;

  function layout(): void {
    dpr = window.devicePixelRatio || 1;
    const L = viewSize(doc);
    const rect = container.getBoundingClientRect();
    const cssW = Math.max(32, rect.width - BEZEL_PAD * 2);
    const cssH = Math.max(32, rect.height - BEZEL_PAD * 2);
    devW = Math.floor(cssW * dpr);
    devH = Math.floor(cssH * dpr);
    canvas.width = devW;
    canvas.height = devH;
    canvas.style.width = `${devW / dpr}px`;
    canvas.style.height = `${devH / dpr}px`;
    // largest integer device zoom that fits, centered, letterboxed
    const focus = store.get().focus;
    const C = doc.cellSize;
    Lf = focus ? C : L;
    fx0 = focus ? focus.cx * C : 0;
    fy0 = focus ? focus.cy * C : 0;
    z = Math.max(1, Math.floor(Math.min(devW, devH) / Lf));
    const art = Lf * z;
    ox = Math.floor((devW - art) / 2);
    oy = Math.floor((devH - art) / 2);
    checker.width = art;
    checker.height = art;
    drawChecker(checkerCtx, Lf, z);
    laidOutL = L;
    needLayout = false;
  }

  function bufferImageData(b: PixelBuffer): ImageData {
    const bytes = new Uint8ClampedArray(
      b.data.buffer as ArrayBuffer,
      b.data.byteOffset,
      b.data.length * 4,
    );
    return new ImageData(bytes, b.w, b.h);
  }

  function render(): void {
    const s = store.get();
    const L = viewSize(doc);
    if (needLayout || L !== laidOutL || (window.devicePixelRatio || 1) !== dpr) layout();
    const C = doc.cellSize;

    // compose the native-resolution view
    offNative.width = L;
    offNative.height = L;
    if (s.mode === "border") {
      offNativeCtx.putImageData(bufferImageData(doc.border), 0, 0);
    } else {
      offTile.width = C;
      offTile.height = C;
      offTileCtx.putImageData(bufferImageData(doc.tile), 0, 0);
      offNativeCtx.clearRect(0, 0, L, L);
      for (let ty = 0; ty < 3; ty++) {
        for (let tx = 0; tx < 3; tx++) {
          offNativeCtx.drawImage(offTile, tx * C, ty * C);
        }
      }
    }

    // display: clear the full canvas (letterbox shows the light-well bezel),
    // then checker under the art, the art window, then chrome — all inside
    // the art rect.
    ctx.clearRect(0, 0, devW, devH);
    ctx.drawImage(checker, ox, oy);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(offNative, fx0, fy0, Lf, Lf, ox, oy, Lf * z, Lf * z);
    if (!s.focus) {
      // thirds delineation / center lock are meaningless inside one cell
      ctx.save();
      ctx.translate(ox, oy);
      drawDelineation(ctx, L, z, s.mode);
      if (s.mode === "border") drawCenterLock(ctx, C, z, dpr);
      ctx.restore();
    } else {
      // letterbox mini-map (decorative — skipped when the letterbox is tight)
      drawFocusMinimap(ctx, {
        mode: s.mode,
        cx: s.focus.cx,
        cy: s.focus.cy,
        devW,
        devH,
        ox,
        oy,
        artSize: Lf * z,
      });
    }

    // selection ants — float bounds if one is floating, else the marked rect
    const marked = sel.rect;
    if (marked) {
      ctx.save();
      ctx.translate(ox, oy);
      ctx.beginPath();
      ctx.rect(0, 0, Lf * z, Lf * z);
      ctx.clip();
      drawMarquee(ctx, marked.x - fx0, marked.y - fy0, marked.w, marked.h, z);
      ctx.restore();
    }
  }

  function requestRender(): void {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      render();
    });
  }

  // ── ToolContext ────────────────────────────────────────────────────
  let snap: Uint32Array | null = null;
  const toolCtx: ToolContext = {
    get size() {
      return viewSize(doc);
    },
    plot(x, y) {
      plotView(doc, store.get().mode, x, y, store.get().color);
    },
    erase(x, y) {
      plotView(doc, store.get().mode, x, y, 0);
    },
    fill(x, y) {
      return floodView(doc, store.get().mode, x, y, store.get().color);
    },
    pick(x, y) {
      const c = getViewPx(doc, store.get().mode, x, y);
      if (alphaOf(c) === 0) {
        store.set({ tip: "nothing there. transparent" });
        return;
      }
      const hex = u32ToHex(c);
      store.set({ color: c, colorHex: hex, tip: `picked ${hex}` });
    },
    snapshot() {
      snap = activeBuffer(doc, store.get().mode).data.slice();
    },
    restore() {
      if (snap) activeBuffer(doc, store.get().mode).data.set(snap);
    },
    beginStroke() {
      deps.beginStroke();
    },
    commit() {
      snap = null;
      deps.commit();
    },
    setSelection(r) {
      sel.rect = r;
      bumpSel();
    },
    getSelection() {
      return sel.rect;
    },
  };

  // ── pointer plumbing ───────────────────────────────────────────────
  let drawing = false;

  /** Device-px position relative to the art rect's origin. */
  function toArt(e: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * dpr - ox,
      y: (e.clientY - rect.top) * dpr - oy,
    };
  }

  /** True when the pointer is inside the art rect (not the letterbox). */
  function inArt(e: PointerEvent): boolean {
    const a = toArt(e);
    const art = Lf * z;
    return a.x >= 0 && a.y >= 0 && a.x < art && a.y < art;
  }

  function toPt(e: PointerEvent): Pt {
    const a = toArt(e);
    const x = Math.floor(a.x / z) + fx0;
    const y = Math.floor(a.y / z) + fy0;
    const s = store.get();
    if (!s.focus) {
      const L = viewSize(doc);
      return { x: clampN(x, 0, L - 1), y: clampN(y, 0, L - 1) };
    }
    if (deps.getTool().clampToWindow) {
      // selection gestures never reach past what the window shows
      return { x: clampN(x, fx0, fx0 + Lf - 1), y: clampN(y, fy0, fy0 + Lf - 1) };
    }
    const C = doc.cellSize;
    if (s.mode === "border") {
      // focused border: the pointer cannot paint outside the focused cell
      return { x: clampN(x, fx0, fx0 + C - 1), y: clampN(y, fy0, fy0 + C - 1) };
    }
    // focused tile: allow one cell of raw margin — never wrap before
    // rasterizing; plotTile's modulo wraps every plotted pixel (torus)
    return {
      x: clampN(x, fx0 - C, fx0 + 2 * C - 1),
      y: clampN(y, fy0 - C, fy0 + 2 * C - 1),
    };
  }

  /** What the LCD shows for a mapped point: in focused tile mode the raw
   *  margin coordinates display wrapped onto the cell, so the readout never
   *  leaves range while tools keep receiving raw values. */
  function displayPt(p: Pt): Pt {
    const s = store.get();
    if (!s.focus || s.mode !== "tile") return p;
    const C = doc.cellSize;
    return { x: fx0 + modN(p.x - fx0, C), y: fy0 + modN(p.y - fy0, C) };
  }

  function bumpDoc(): void {
    store.set({ dirtyDoc: store.get().dirtyDoc + 1 });
  }

  function bumpSel(): void {
    store.set({ dirtySel: store.get().dirtySel + 1 });
  }

  /** Passive tools (selection) re-render only — no preview / autosave churn. */
  function bumpForTool(): void {
    if (deps.getTool().passive) bumpSel();
    else bumpDoc();
  }

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (!inArt(e)) return; // no stroke (and no Alt-pick) starts from the letterbox
    canvas.setPointerCapture(e.pointerId);
    const p = toPt(e);
    if (e.altKey) {
      toolCtx.pick(p.x, p.y);
      return;
    }
    drawing = true;
    deps.getTool().onDown(p, toolCtx);
    bumpForTool();
  });

  canvas.addEventListener("pointermove", (e) => {
    const p = toPt(e);
    const hov = inArt(e) ? displayPt(p) : null;
    const s = store.get();
    if (
      (hov === null) !== (s.hover === null) ||
      (hov && s.hover && (hov.x !== s.hover.x || hov.y !== s.hover.y))
    ) {
      store.set({ hover: hov });
    }
    if (!drawing) return;
    deps.getTool().onMove(p, toolCtx);
    bumpForTool();
  });

  const finish = (e: PointerEvent): void => {
    if (!drawing) return;
    drawing = false;
    deps.getTool().onUp(toPt(e), toolCtx);
    bumpForTool();
  };
  canvas.addEventListener("pointerup", finish);
  canvas.addEventListener("pointercancel", finish);
  canvas.addEventListener("pointerleave", () => {
    if (!drawing) store.set({ hover: null });
  });

  // ── invalidation ───────────────────────────────────────────────────
  store.subscribe((s, prev) => {
    if (
      s.dirtyDoc !== prev.dirtyDoc ||
      s.dirtySel !== prev.dirtySel ||
      s.mode !== prev.mode ||
      s.cellSize !== prev.cellSize ||
      s.focus !== prev.focus
    ) {
      if (s.cellSize !== prev.cellSize || s.focus !== prev.focus) needLayout = true;
      requestRender();
    }
  });

  const ro = new ResizeObserver(() => {
    needLayout = true;
    requestRender();
  });
  ro.observe(container);

  // DPR changes (window dragged between monitors) — ResizeObserver alone
  // won't catch them; re-arm a matchMedia listener each time it fires.
  function watchDpr(): void {
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    const onChange = (): void => {
      mq.removeEventListener("change", onChange);
      needLayout = true;
      requestRender();
      watchDpr();
    };
    mq.addEventListener("change", onChange);
  }
  watchDpr();

  layout();
  render();

  return {
    requestRender,
    relayout() {
      needLayout = true;
      requestRender();
    },
  };
}

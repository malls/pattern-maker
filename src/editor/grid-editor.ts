/** The left canvas: crisp integer zoom, DPR handling, pointer→pixel mapping,
 *  render loop, and the ToolContext bridge between pointer gestures and the
 *  document. */

import type { PixelBuffer } from "../raster/buffer";
import { alphaOf, u32ToHex } from "../raster/buffer";
import type { AppState, Store } from "../state/store";
import type { Doc } from "../state/doc";
import { activeBuffer, floodView, getViewPx, plotView, viewSize } from "../state/doc";
import type { Pt, Tool, ToolContext } from "../tools/types";
import { drawCenterLock, drawChecker, drawDelineation } from "./chrome";

export interface GridEditorDeps {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  store: Store<AppState>;
  doc: Doc;
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

export function createGridEditor(deps: GridEditorDeps): GridEditor {
  const { canvas, container, store, doc } = deps;
  const ctx = get2d(canvas);

  // offscreen canvases
  const offNative = document.createElement("canvas"); // L×L composed view
  const offTile = document.createElement("canvas"); // C×C tile scratch
  const checker = document.createElement("canvas"); // device-scale cache
  const offNativeCtx = get2d(offNative);
  const offTileCtx = get2d(offTile);
  const checkerCtx = get2d(checker);

  let z = 1;
  let dpr = window.devicePixelRatio || 1;
  let laidOutL = 0;
  let needLayout = true;
  let renderQueued = false;

  function layout(): void {
    dpr = window.devicePixelRatio || 1;
    const L = viewSize(doc);
    const rect = container.getBoundingClientRect();
    const availW = Math.max(32, rect.width - BEZEL_PAD * 2);
    const availH = Math.max(32, rect.height - BEZEL_PAD * 2);
    const avail = Math.min(availW, availH);
    z = Math.max(1, Math.floor((avail * dpr) / L));
    const device = L * z;
    canvas.width = device;
    canvas.height = device;
    canvas.style.width = `${device / dpr}px`;
    canvas.style.height = `${device / dpr}px`;
    checker.width = device;
    checker.height = device;
    drawChecker(checkerCtx, L, z);
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
    const device = L * z;

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

    // display at device scale: checker under the art, art, then chrome
    ctx.clearRect(0, 0, device, device);
    ctx.drawImage(checker, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(offNative, 0, 0, device, device);
    drawDelineation(ctx, L, z, s.mode);
    if (s.mode === "border") drawCenterLock(ctx, C, z, dpr);
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
  };

  // ── pointer plumbing ───────────────────────────────────────────────
  let drawing = false;

  function toPt(e: PointerEvent): Pt {
    const rect = canvas.getBoundingClientRect();
    const L = viewSize(doc);
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * L);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * L);
    return { x: Math.max(0, Math.min(L - 1, x)), y: Math.max(0, Math.min(L - 1, y)) };
  }

  function bumpDoc(): void {
    store.set({ dirtyDoc: store.get().dirtyDoc + 1 });
  }

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const p = toPt(e);
    if (e.altKey) {
      toolCtx.pick(p.x, p.y);
      return;
    }
    drawing = true;
    deps.getTool().onDown(p, toolCtx);
    bumpDoc();
  });

  canvas.addEventListener("pointermove", (e) => {
    const p = toPt(e);
    const s = store.get();
    if (!s.hover || s.hover.x !== p.x || s.hover.y !== p.y) {
      store.set({ hover: p });
    }
    if (!drawing) return;
    deps.getTool().onMove(p, toolCtx);
    bumpDoc();
  });

  const finish = (e: PointerEvent): void => {
    if (!drawing) return;
    drawing = false;
    deps.getTool().onUp(toPt(e), toolCtx);
    bumpDoc();
  };
  canvas.addEventListener("pointerup", finish);
  canvas.addEventListener("pointercancel", finish);
  canvas.addEventListener("pointerleave", () => {
    if (!drawing) store.set({ hover: null });
  });

  // ── invalidation ───────────────────────────────────────────────────
  store.subscribe((s, prev) => {
    if (s.dirtyDoc !== prev.dirtyDoc || s.mode !== prev.mode || s.cellSize !== prev.cellSize) {
      if (s.cellSize !== prev.cellSize) needLayout = true;
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

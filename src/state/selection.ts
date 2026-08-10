/** Rect selection + floating paste — pure buffer/coordinate work, DOM-free by
 *  design (same seam as doc.ts).
 *
 *  Everything here speaks logical VIEW coordinates (0..L-1, the space tools
 *  already use). Mode semantics come for free from doc.ts: copying reads
 *  through `getViewPx` (tile wraps on the torus; the border's locked centre is
 *  empty by invariant, so it reads transparent) and erasing/stamping writes
 *  through `plotView` (border clips the locked centre and out-of-bounds; tile
 *  wraps).
 *
 *  Selection is ephemeral view state: never persisted, never in undo history. */

import type { PixelBuffer } from "../raster/buffer";
import { createBuffer } from "../raster/buffer";
import type { Doc, Mode } from "./doc";
import { getViewPx, plotView } from "./doc";

/** Marked region in view coordinates. Normalized: w, h ≥ 1. */
export interface SelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A pasted buffer hovering above the document, positioned by its top-left
 *  corner in view coordinates. Nothing about it has touched the doc yet. */
export interface Float {
  buf: PixelBuffer;
  x: number;
  y: number;
}

/** `rect` and `float` are mutually exclusive — pasting clears the rect,
 *  stamping re-selects the stamped bounds. */
export interface SelectionState {
  rect: SelRect | null;
  float: Float | null;
}

export function createSelection(): SelectionState {
  return { rect: null, float: null };
}

/** Inclusive rect between two view points (either drag direction). */
export function rectFromPoints(ax: number, ay: number, bx: number, by: number): SelRect {
  return {
    x: Math.min(ax, bx),
    y: Math.min(ay, by),
    w: Math.abs(bx - ax) + 1,
    h: Math.abs(by - ay) + 1,
  };
}

/** Read a view-space rect into a new buffer (tile: wraps; border: the locked
 *  centre and anything off-sheet read transparent). */
export function copyRect(doc: Doc, mode: Mode, r: SelRect): PixelBuffer {
  const out = createBuffer(r.w, r.h);
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      out.data[y * r.w + x] = getViewPx(doc, mode, r.x + x, r.y + y);
    }
  }
  return out;
}

/** Erase a view-space rect to transparency (tile: wraps; border: the locked
 *  centre and out-of-bounds reject). */
export function eraseRect(doc: Doc, mode: Mode, r: SelRect): void {
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      plotView(doc, mode, r.x + x, r.y + y, 0);
    }
  }
}

/** Stamp a float verbatim — every pixel, including fully transparent ones,
 *  replaces its destination. Border clips, tile wraps. */
export function stampFloat(doc: Doc, mode: Mode, f: Float): void {
  const { buf } = f;
  for (let y = 0; y < buf.h; y++) {
    for (let x = 0; x < buf.w; x++) {
      plotView(doc, mode, f.x + x, f.y + y, buf.data[y * buf.w + x] ?? 0);
    }
  }
}

/** Clamp a float position fully inside the window [wx0, wx0+ww) × [wy0, wy0+wh)
 *  per axis. A float larger than the window pins to the window origin. */
export function clampFloatPos(
  f: Float,
  wx0: number,
  wy0: number,
  ww: number,
  wh: number,
): { x: number; y: number } {
  const cx = Math.max(wx0, Math.min(f.x, wx0 + ww - f.buf.w));
  const cy = Math.max(wy0, Math.min(f.y, wy0 + wh - f.buf.h));
  return { x: cx, y: cy };
}

/** Top-left crop into a new buffer (a clipboard can outlive the cell size it
 *  was taken at; pasting never exceeds the view). */
export function cropTopLeft(b: PixelBuffer, w: number, h: number): PixelBuffer {
  if (w === b.w && h === b.h) return b;
  const out = createBuffer(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      out.data[y * w + x] = b.data[y * b.w + x] ?? 0;
    }
  }
  return out;
}

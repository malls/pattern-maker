/** Document model — per-mode pixel buffers plus mode semantics: the border
 *  sheet's locked center and the tile view's torus wrap. DOM-free by design.
 *
 *  One project holds BOTH mode documents so switching modes never loses work.
 *  Both modes are edited through an L×L "view" where L = 3·cellSize:
 *  - border: the view IS the 3×3 sheet; the center cell region rejects writes.
 *  - tile: view coords map onto the single tile via true modulo — that one
 *    mapping is the torus wrap. */

import type { PixelBuffer } from "../raster/buffer";
import { clear, createBuffer, getPx, resizeNearest, setPx } from "../raster/buffer";
import { floodFill } from "../raster/raster";

export type Mode = "border" | "tile";

export const CELL_SIZES: readonly number[] = [8, 12, 16, 24, 32, 48, 64];
export const MIN_CELL = 8;
export const MAX_CELL = 64;

export interface Doc {
  cellSize: number;
  border: PixelBuffer;
  tile: PixelBuffer;
}

export function createDoc(cellSize: number): Doc {
  return {
    cellSize,
    border: createBuffer(cellSize * 3, cellSize * 3),
    tile: createBuffer(cellSize, cellSize),
  };
}

/** Logical view size (both modes' views are L×L). */
export function viewSize(doc: Doc): number {
  return doc.cellSize * 3;
}

export function inLockedCenter(doc: Doc, x: number, y: number): boolean {
  const s = doc.cellSize;
  return x >= s && x < 2 * s && y >= s && y < 2 * s;
}

const mod = (n: number, m: number): number => ((n % m) + m) % m;

/** Border plot — silently rejects the locked center and out-of-bounds. */
export function plotBorder(doc: Doc, x: number, y: number, c: number): void {
  const L = viewSize(doc);
  if (x < 0 || y < 0 || x >= L || y >= L) return;
  if (inLockedCenter(doc, x, y)) return;
  setPx(doc.border, x, y, c);
}

/** Tile plot — view coords wrap onto the tile (torus). */
export function plotTile(doc: Doc, vx: number, vy: number, c: number): void {
  const s = doc.cellSize;
  setPx(doc.tile, mod(vx, s), mod(vy, s), c);
}

export function plotView(doc: Doc, mode: Mode, x: number, y: number, c: number): void {
  if (mode === "border") plotBorder(doc, x, y, c);
  else plotTile(doc, x, y, c);
}

/** Color under a view coordinate (border: 0 inside the locked center). */
export function getViewPx(doc: Doc, mode: Mode, x: number, y: number): number {
  if (mode === "border") return getPx(doc.border, x, y);
  const s = doc.cellSize;
  return getPx(doc.tile, mod(x, s), mod(y, s));
}

/** Flood fill at a view coordinate. Border: bounded, locked center is a wall.
 *  Tile: torus flood over the single tile. Returns true if pixels changed. */
export function floodView(doc: Doc, mode: Mode, x: number, y: number, c: number): boolean {
  if (mode === "border") {
    const L = viewSize(doc);
    if (x < 0 || y < 0 || x >= L || y >= L) return false;
    if (inLockedCenter(doc, x, y)) return false;
    return floodFill(
      (px, py) => (inLockedCenter(doc, px, py) ? -1 : getPx(doc.border, px, py)),
      (px, py, col) => setPx(doc.border, px, py, col),
      L,
      L,
      x,
      y,
      c,
      false,
    );
  }
  const s = doc.cellSize;
  return floodFill(
    (px, py) => getPx(doc.tile, px, py),
    (px, py, col) => setPx(doc.tile, px, py, col),
    s,
    s,
    mod(x, s),
    mod(y, s),
    c,
    true,
  );
}

/** The buffer a mode edits/exports (border: full sheet; tile: single tile). */
export function activeBuffer(doc: Doc, mode: Mode): PixelBuffer {
  return mode === "border" ? doc.border : doc.tile;
}

export function clearMode(doc: Doc, mode: Mode): void {
  clear(activeBuffer(doc, mode));
}

/** Wipe the border sheet's locked center back to transparent. */
export function clearLockedCenter(doc: Doc): void {
  const s = doc.cellSize;
  for (let y = s; y < 2 * s; y++) {
    for (let x = s; x < 2 * s; x++) {
      setPx(doc.border, x, y, 0);
    }
  }
}

/** Resample both buffers to a new cell size (nearest-neighbor) and re-clear
 *  the border center. Callers push undo snapshots first. */
export function setCellSize(doc: Doc, cellSize: number): void {
  if (cellSize === doc.cellSize) return;
  doc.cellSize = cellSize;
  doc.border = resizeNearest(doc.border, cellSize * 3, cellSize * 3);
  doc.tile = resizeNearest(doc.tile, cellSize, cellSize);
  clearLockedCenter(doc);
}

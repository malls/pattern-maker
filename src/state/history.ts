/** Undo/redo — snapshot stacks, one pair per mode (undo in border mode must
 *  not revert tile work). DOM-free by design.
 *
 *  Entries carry the cellSize they were taken at. Cell-size changes push a
 *  snapshot onto BOTH mode stacks (the resample touches both buffers); when
 *  restoring an entry whose cellSize differs from the doc's current one, the
 *  doc switches to that cellSize and the *other* mode's buffer is resampled
 *  to keep the document invariant (border = 3C², tile = C²). */

import { resizeNearest } from "../raster/buffer";
import type { Doc, Mode } from "./doc";
import { activeBuffer, clearLockedCenter } from "./doc";

export interface HistoryEntry {
  cellSize: number;
  data: Uint32Array;
}

interface ModeStacks {
  undo: HistoryEntry[];
  redo: HistoryEntry[];
}

export interface Histories {
  border: ModeStacks;
  tile: ModeStacks;
}

const CAP = 64;

export function createHistories(): Histories {
  return {
    border: { undo: [], redo: [] },
    tile: { undo: [], redo: [] },
  };
}

function snapshot(doc: Doc, mode: Mode): HistoryEntry {
  return { cellSize: doc.cellSize, data: activeBuffer(doc, mode).data.slice() };
}

/** Push an undo entry for one mode. Clears that mode's redo stack. */
export function push(h: Histories, doc: Doc, mode: Mode): void {
  const s = h[mode];
  s.undo.push(snapshot(doc, mode));
  if (s.undo.length > CAP) s.undo.shift();
  s.redo.length = 0;
}

/** Cell-size changes mutate both buffers — snapshot both modes. */
export function pushBoth(h: Histories, doc: Doc): void {
  push(h, doc, "border");
  push(h, doc, "tile");
}

function apply(doc: Doc, mode: Mode, e: HistoryEntry): void {
  if (e.cellSize !== doc.cellSize) {
    doc.cellSize = e.cellSize;
    if (mode === "border") {
      doc.tile = resizeNearest(doc.tile, e.cellSize, e.cellSize);
    } else {
      doc.border = resizeNearest(doc.border, e.cellSize * 3, e.cellSize * 3);
      clearLockedCenter(doc);
    }
  }
  const size = mode === "border" ? e.cellSize * 3 : e.cellSize;
  const buf = { w: size, h: size, data: e.data.slice() };
  if (mode === "border") doc.border = buf;
  else doc.tile = buf;
}

export function undo(h: Histories, doc: Doc, mode: Mode): boolean {
  const s = h[mode];
  const e = s.undo.pop();
  if (!e) return false;
  s.redo.push(snapshot(doc, mode));
  apply(doc, mode, e);
  return true;
}

export function redo(h: Histories, doc: Doc, mode: Mode): boolean {
  const s = h[mode];
  const e = s.redo.pop();
  if (!e) return false;
  s.undo.push(snapshot(doc, mode));
  if (s.undo.length > CAP) s.undo.shift();
  apply(doc, mode, e);
  return true;
}

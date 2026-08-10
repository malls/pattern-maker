/** Project persistence: JSON encode/decode (pure), localStorage autosave,
 *  file download/import (the only DOM-touching parts — kept behind small
 *  functions as the platform seam). */

import { fromBase64, hexToU32, toBase64 } from "../raster/buffer";
import type { Doc, Mode } from "./doc";
import { MAX_CELL, MIN_CELL, clearLockedCenter } from "./doc";

export const STORAGE_KEY = "pattern-maker.project.v1";

export interface ProjectV1 {
  app: "pattern-maker";
  version: 1;
  savedAt: string;
  mode: Mode;
  cellSize: number;
  color: string;
  border: { w: number; h: number; data: string };
  tile: { w: number; h: number; data: string };
}

export interface DecodedProject {
  doc: Doc;
  mode: Mode;
  colorHex: string;
}

export function encodeProject(doc: Doc, mode: Mode, colorHex: string): string {
  const p: ProjectV1 = {
    app: "pattern-maker",
    version: 1,
    savedAt: new Date().toISOString(),
    mode,
    cellSize: doc.cellSize,
    color: colorHex,
    border: { w: doc.border.w, h: doc.border.h, data: toBase64(doc.border) },
    tile: { w: doc.tile.w, h: doc.tile.h, data: toBase64(doc.tile) },
  };
  return JSON.stringify(p);
}

/** Strict decode — validates everything, returns null on any failure so a
 *  corrupt file never partially loads. Pure (usable outside the DOM). */
export function decodeProject(json: string): DecodedProject | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const p = raw as Record<string, unknown>;
  if (p["app"] !== "pattern-maker" || p["version"] !== 1) return null;

  const mode = p["mode"];
  if (mode !== "border" && mode !== "tile") return null;

  const cellSize = p["cellSize"];
  if (
    typeof cellSize !== "number" ||
    !Number.isInteger(cellSize) ||
    cellSize < MIN_CELL ||
    cellSize > MAX_CELL
  ) {
    return null;
  }

  const color = p["color"];
  if (typeof color !== "string" || hexToU32(color) === null) return null;

  const readBuf = (v: unknown, w: number, h: number) => {
    if (typeof v !== "object" || v === null) return null;
    const o = v as Record<string, unknown>;
    if (o["w"] !== w || o["h"] !== h || typeof o["data"] !== "string") return null;
    return fromBase64(o["data"], w, h);
  };

  const border = readBuf(p["border"], cellSize * 3, cellSize * 3);
  const tile = readBuf(p["tile"], cellSize, cellSize);
  if (!border || !tile) return null;

  const doc: Doc = { cellSize, border, tile };
  clearLockedCenter(doc); // enforce the invariant whatever the file claims
  return { doc, mode, colorHex: color };
}

/* ── localStorage autosave ──────────────────────────────────────────── */

export function autosave(doc: Doc, mode: Mode, colorHex: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, encodeProject(doc, mode, colorHex));
  } catch {
    /* storage full or unavailable — autosave is best-effort */
  }
}

export function loadAutosave(): DecodedProject | null {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return null;
    return decodeProject(json);
  } catch {
    return null;
  }
}

/* ── file download / import ─────────────────────────────────────────── */

export function downloadProject(doc: Doc, mode: Mode, colorHex: string): void {
  const blob = new Blob([encodeProject(doc, mode, colorHex)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.download = "pattern.json";
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
}

/** Open a file picker and decode the chosen project. Resolves null if the
 *  file is unreadable or invalid; resolves undefined-like never on cancel
 *  (the callback simply never fires). */
export function pickAndImportProject(onDone: (p: DecodedProject | null) => void): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    file
      .text()
      .then((text) => onDone(decodeProject(text)))
      .catch(() => onDone(null));
  });
  input.click();
}

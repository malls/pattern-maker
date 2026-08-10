/** Minimal observable store — the app's only communication mechanism. */

import type { Mode } from "./doc";

export interface Store<T extends object> {
  get(): T;
  set(patch: Partial<T>): void;
  subscribe(fn: (s: T, prev: T) => void): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const subs = new Set<(s: T, prev: T) => void>();
  return {
    get: () => state,
    set(patch) {
      const prev = state;
      state = { ...state, ...patch };
      for (const fn of [...subs]) fn(state, prev);
    },
    subscribe(fn) {
      subs.add(fn);
      return () => {
        subs.delete(fn);
      };
    },
  };
}

/** UI-ish app state. The pixel buffers live in the Doc (mutable typed
 *  arrays — never copied through the store); mutations bump dirtyDoc, and
 *  finished gestures bump dirtyPreview. */
export interface AppState {
  mode: Mode;
  tool: string;
  /** current color, packed u32 (see raster/buffer.ts) */
  color: number;
  /** current color as '#rrggbb' for chips / persistence */
  colorHex: string;
  cellSize: number;
  /** zoom-to-one-cell: which 3×3 cell is focused, or null (whole view).
   *  Ephemeral UI state — never persisted, never in undo history.
   *  cx, cy ∈ {0,1,2}; border mode never allows (1,1). */
  focus: { cx: number; cy: number } | null;
  hover: { x: number; y: number } | null;
  /** PNG/CSS output upscale ∈ {1,2,4}. Session-only UI state — never
   *  persisted, never in undo history, never applied to the live previews. */
  exportScale: 1 | 2 | 4;
  dirtyDoc: number;
  dirtyPreview: number;
  /** bumped on any selection/float change. Drives the editor re-render ONLY —
   *  selection is ephemeral view state (never persisted, never in history), so
   *  marquee drags and float moves must not churn previews or autosave. */
  dirtySel: number;
  tip: string;
}

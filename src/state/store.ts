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
  hover: { x: number; y: number } | null;
  dirtyDoc: number;
  dirtyPreview: number;
  tip: string;
}

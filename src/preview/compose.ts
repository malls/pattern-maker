/** PixelBuffer → PNG data URI (shared by previews and exports) + debounce. */

import type { PixelBuffer } from "../raster/buffer";

export function bufferToCanvas(b: PixelBuffer): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = b.w;
  canvas.height = b.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  const bytes = new Uint8ClampedArray(
    b.data.buffer as ArrayBuffer,
    b.data.byteOffset,
    b.data.length * 4,
  );
  ctx.putImageData(new ImageData(bytes, b.w, b.h), 0, 0);
  return canvas;
}

export function bufferToDataURI(b: PixelBuffer): string {
  return bufferToCanvas(b).toDataURL("image/png");
}

export interface Debounced<A extends unknown[]> {
  (...args: A): void;
  /** run immediately, cancelling any pending call */
  now(...args: A): void;
  cancel(): void;
}

export function debounce<A extends unknown[]>(ms: number, fn: (...args: A) => void): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const clear = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
  const d = (...args: A): void => {
    clear();
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  };
  d.now = (...args: A): void => {
    clear();
    fn(...args);
  };
  d.cancel = clear;
  return d;
}

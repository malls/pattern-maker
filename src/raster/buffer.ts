/** PixelBuffer — Uint32Array-backed RGBA raster. DOM-free by design.
 *
 * Packing is byte-order ABGR in the u32 (0xAABBGGRR), i.e. the little-endian
 * u32 view over the same bytes ImageData uses (r,g,b,a). 0x00000000 is
 * transparent. */

export interface PixelBuffer {
  readonly w: number;
  readonly h: number;
  readonly data: Uint32Array;
}

export function createBuffer(w: number, h: number): PixelBuffer {
  return { w, h, data: new Uint32Array(w * h) };
}

export function getPx(b: PixelBuffer, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= b.w || y >= b.h) return 0;
  return b.data[y * b.w + x] ?? 0;
}

export function setPx(b: PixelBuffer, x: number, y: number, rgba: number): void {
  if (x < 0 || y < 0 || x >= b.w || y >= b.h) return;
  b.data[y * b.w + x] = rgba >>> 0;
}

export function clone(b: PixelBuffer): PixelBuffer {
  return { w: b.w, h: b.h, data: b.data.slice() };
}

export function clear(b: PixelBuffer): void {
  b.data.fill(0);
}

export function fillAll(b: PixelBuffer, rgba: number): void {
  b.data.fill(rgba >>> 0);
}

/** Nearest-neighbor resample into a new buffer. */
export function resizeNearest(b: PixelBuffer, w: number, h: number): PixelBuffer {
  const out = createBuffer(w, h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(b.h - 1, Math.floor((y * b.h) / h));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(b.w - 1, Math.floor((x * b.w) / w));
      out.data[y * w + x] = b.data[sy * b.w + sx] ?? 0;
    }
  }
  return out;
}

/** Integer nearest-neighbor upscale (1 returns the same buffer — no copy). */
export function scaleUp(b: PixelBuffer, factor: number): PixelBuffer {
  return factor <= 1 ? b : resizeNearest(b, b.w * factor, b.h * factor);
}

/* ── color packing ──────────────────────────────────────────────────── */

export function packRGBA(r: number, g: number, b: number, a: number): number {
  return (((a & 255) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)) >>> 0;
}

/** '#rrggbb' → packed u32 (alpha 255). Returns null on malformed input. */
export function hexToU32(hex: string): number | null {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
  const n = parseInt(hex.slice(1), 16);
  return packRGBA((n >> 16) & 255, (n >> 8) & 255, n & 255, 255);
}

/** packed u32 → '#rrggbb' (alpha dropped). */
export function u32ToHex(c: number): string {
  const r = c & 255;
  const g = (c >> 8) & 255;
  const b = (c >> 16) & 255;
  const to2 = (n: number): string => n.toString(16).padStart(2, "0");
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

export function alphaOf(c: number): number {
  return (c >>> 24) & 255;
}

/* ── base64 codec (pure — no btoa/Buffer, keeps the module portable) ── */

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
let B64_REV: Int16Array | null = null;

function b64rev(): Int16Array {
  if (!B64_REV) {
    B64_REV = new Int16Array(128).fill(-1);
    for (let i = 0; i < B64.length; i++) B64_REV[B64.charCodeAt(i)] = i;
  }
  return B64_REV;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  const n = bytes.length;
  for (let i = 0; i < n; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    const v = (b0 << 16) | (b1 << 8) | b2;
    out += B64.charAt((v >> 18) & 63) + B64.charAt((v >> 12) & 63);
    out += i + 1 < n ? B64.charAt((v >> 6) & 63) : "=";
    out += i + 2 < n ? B64.charAt(v & 63) : "=";
  }
  return out;
}

export function base64ToBytes(s: string): Uint8Array | null {
  if (s.length % 4 !== 0) return null;
  const rev = b64rev();
  let pad = 0;
  if (s.endsWith("==")) pad = 2;
  else if (s.endsWith("=")) pad = 1;
  const outLen = (s.length / 4) * 3 - pad;
  const out = new Uint8Array(outLen);
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    let v = 0;
    for (let j = 0; j < 4; j++) {
      const ch = s.charCodeAt(i + j);
      if (ch === 61 /* '=' */ && i + j >= s.length - pad) {
        v <<= 6;
        continue;
      }
      const d = ch < 128 ? (rev[ch] ?? -1) : -1;
      if (d < 0) return null;
      v = (v << 6) | d;
    }
    if (o < outLen) out[o++] = (v >> 16) & 255;
    if (o < outLen) out[o++] = (v >> 8) & 255;
    if (o < outLen) out[o++] = v & 255;
  }
  return out;
}

/** Raw pixel bytes → base64 (no PNG involved). */
export function toBase64(b: PixelBuffer): string {
  const bytes = new Uint8Array(b.data.buffer, b.data.byteOffset, b.data.length * 4);
  return bytesToBase64(bytes);
}

/** base64 raw pixel bytes → buffer; null if the payload doesn't decode to w*h*4 bytes. */
export function fromBase64(s: string, w: number, h: number): PixelBuffer | null {
  const bytes = base64ToBytes(s);
  if (!bytes || bytes.length !== w * h * 4) return null;
  const copy = new Uint8Array(bytes); // guarantee offset 0 / tight buffer
  return { w, h, data: new Uint32Array(copy.buffer) };
}

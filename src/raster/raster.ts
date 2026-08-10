/** Pure raster algorithms. Everything emits through a plot(x, y) callback so
 *  mode semantics (center lock, torus wrap) live in the document, not here.
 *  DOM-free by design. */

export type Plot = (x: number, y: number) => void;

/** Integer Bresenham line, inclusive of both endpoints. */
export function line(x0: number, y0: number, x1: number, y1: number, plot: Plot): void {
  let x = x0 | 0;
  let y = y0 | 0;
  const ex = x1 | 0;
  const ey = y1 | 0;
  const dx = Math.abs(ex - x);
  const dy = -Math.abs(ey - y);
  const sx = x < ex ? 1 : -1;
  const sy = y < ey ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    plot(x, y);
    if (x === ex && y === ey) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

/** Axis-aligned rectangle outline from any two corners. */
export function rectOutline(x0: number, y0: number, x1: number, y1: number, plot: Plot): void {
  const lx = Math.min(x0, x1) | 0;
  const rx = Math.max(x0, x1) | 0;
  const ty = Math.min(y0, y1) | 0;
  const by = Math.max(y0, y1) | 0;
  for (let x = lx; x <= rx; x++) {
    plot(x, ty);
    if (by !== ty) plot(x, by);
  }
  for (let y = ty + 1; y < by; y++) {
    plot(lx, y);
    if (rx !== lx) plot(rx, y);
  }
}

/** Axis-aligned filled rectangle from any two corners (inclusive). A superset
 *  of rectOutline over the same corners, so no separate outline pass is needed;
 *  a zero-size drag plots exactly one pixel, as the outline does. */
export function rectFilled(x0: number, y0: number, x1: number, y1: number, plot: Plot): void {
  const lx = Math.min(x0, x1) | 0;
  const rx = Math.max(x0, x1) | 0;
  const ty = Math.min(y0, y1) | 0;
  const by = Math.max(y0, y1) | 0;
  for (let y = ty; y <= by; y++) {
    for (let x = lx; x <= rx; x++) plot(x, y);
  }
}

/** Emit the ellipse-outline sample set for a bounding box. Private: the two
 *  public ellipse primitives share it, so a filled ellipse and an outline
 *  ellipse of the same drag have identical silhouettes by construction.
 *  Quarter-arc sampling mirrored 4 ways; mirrors about the (possibly
 *  half-integer) center are exact because lx+rx-x is always an integer. */
function ellipseSamples(lx: number, ty: number, rx: number, by: number, emit: Plot): void {
  const w = rx - lx;
  const hgt = by - ty;
  const cx = (lx + rx) / 2;
  const cy = (ty + by) / 2;
  const a = w / 2;
  const b = hgt / 2;
  const steps = Math.max(8, 2 * (w + hgt)); // sub-pixel arc step → connected outline
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * (Math.PI / 2);
    const px = Math.min(rx, Math.round(cx + a * Math.cos(t)));
    const py = Math.min(by, Math.round(cy + b * Math.sin(t)));
    const mx = lx + rx - px;
    const my = ty + by - py;
    emit(px, py);
    emit(mx, py);
    emit(px, my);
    emit(mx, my);
  }
}

/** Ellipse outline inscribed in the drag's bounding box (inclusive corners). */
export function ellipseOutline(x0: number, y0: number, x1: number, y1: number, plot: Plot): void {
  const lx = Math.min(x0, x1) | 0;
  const rx = Math.max(x0, x1) | 0;
  const ty = Math.min(y0, y1) | 0;
  const by = Math.max(y0, y1) | 0;
  if (rx === lx || by === ty) {
    line(lx, ty, rx, by, plot);
    return;
  }
  ellipseSamples(lx, ty, rx, by, plot);
}

/** Filled ellipse inscribed in the drag's bounding box. Spans run between the
 *  extreme sampled x of each row, so the filled shape's silhouette is exactly
 *  the outline's — by construction, not by two algorithms agreeing. */
export function ellipseFilled(x0: number, y0: number, x1: number, y1: number, plot: Plot): void {
  const lx = Math.min(x0, x1) | 0;
  const rx = Math.max(x0, x1) | 0;
  const ty = Math.min(y0, y1) | 0;
  const by = Math.max(y0, y1) | 0;
  if (rx === lx || by === ty) {
    line(lx, ty, rx, by, plot);
    return;
  }
  const rows = by - ty + 1;
  const lo = new Int32Array(rows).fill(0x7fffffff);
  const hi = new Int32Array(rows).fill(-0x80000000);
  ellipseSamples(lx, ty, rx, by, (x, y) => {
    const i = y - ty;
    if (i < 0 || i >= rows) return; // defensive; the sampler stays in the box
    const l = lo[i] ?? 0;
    const r = hi[i] ?? 0;
    if (x < l) lo[i] = x;
    if (x > r) hi[i] = x;
  });
  for (let i = 0; i < rows; i++) {
    const l = lo[i] ?? 0;
    const r = hi[i] ?? -1;
    if (r < l) continue; // a row the sampler never touched
    const y = ty + i;
    for (let x = l; x <= r; x++) plot(x, y);
  }
}

/**
 * Flood fill over an abstract pixel field.
 *
 * getPx may return -1 to mark a wall (e.g. the border sheet's locked center);
 * walls never match and are never entered. With wrap=true neighbors are taken
 * mod w/h (torus) — a visited set is mandatory there because running off the
 * edge no longer terminates the fill.
 *
 * Returns true if any pixel changed.
 */
export function floodFill(
  getPx: (x: number, y: number) => number,
  setPx: (x: number, y: number, c: number) => void,
  w: number,
  h: number,
  sx: number,
  sy: number,
  replacement: number,
  wrap: boolean,
): boolean {
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return false;
  const target = getPx(sx, sy);
  if (target < 0 || target === (replacement >>> 0)) return false;

  const visited = new Uint8Array(w * h);
  const stack: number[] = [sy * w + sx];
  visited[sy * w + sx] = 1;
  let changed = false;

  while (stack.length > 0) {
    const p = stack.pop() as number;
    const x = p % w;
    const y = (p - x) / w;
    if (getPx(x, y) !== target) continue;
    setPx(x, y, replacement);
    changed = true;

    // 4-neighbors, wrapped or bounds-checked
    let nx = x - 1;
    let ny = y;
    if (wrap || nx >= 0) {
      const cx = wrap ? (nx + w) % w : nx;
      const q = ny * w + cx;
      if (!visited[q]) {
        visited[q] = 1;
        stack.push(q);
      }
    }
    nx = x + 1;
    if (wrap || nx < w) {
      const cx = wrap ? nx % w : nx;
      const q = ny * w + cx;
      if (!visited[q]) {
        visited[q] = 1;
        stack.push(q);
      }
    }
    nx = x;
    ny = y - 1;
    if (wrap || ny >= 0) {
      const cy = wrap ? (ny + h) % h : ny;
      const q = cy * w + nx;
      if (!visited[q]) {
        visited[q] = 1;
        stack.push(q);
      }
    }
    ny = y + 1;
    if (wrap || ny < h) {
      const cy = wrap ? ny % h : ny;
      const q = cy * w + nx;
      if (!visited[q]) {
        visited[q] = 1;
        stack.push(q);
      }
    }
  }
  return changed;
}

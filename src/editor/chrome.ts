/** Editor chrome: transparency checkerboard, cell delineation, locked-center
 *  hatch. All drawing happens at device scale (z device px per logical px). */

import type { Mode } from "../state/doc";

/** Checkerboard under the art — two grays from the token family, one square
 *  per logical pixel. Drawn into a cache canvas on layout changes only. */
export function drawChecker(ctx: CanvasRenderingContext2D, L: number, z: number): void {
  ctx.fillStyle = "#F2F1EC"; // --key
  ctx.fillRect(0, 0, L * z, L * z);
  ctx.fillStyle = "#E7E6E1"; // --plastic
  for (let y = 0; y < L; y++) {
    for (let x = (y & 1) ^ 1; x < L; x += 2) {
      ctx.fillRect(x * z, y * z, z, z);
    }
  }
}

/** Hairline delineation at thirds. Border mode: --key-border; tile mode: the
 *  same lines, faint. 1 device px. */
export function drawDelineation(ctx: CanvasRenderingContext2D, L: number, z: number, mode: Mode): void {
  const C = L / 3;
  ctx.fillStyle = mode === "border" ? "#C6C5BF" : "rgba(35,35,32,.18)";
  for (const t of [C, 2 * C]) {
    ctx.fillRect(Math.round(t * z), 0, 1, L * z);
    ctx.fillRect(0, Math.round(t * z), L * z, 1);
  }
}

/** Border mode: dim + hatch the locked center cell and label it. */
export function drawCenterLock(
  ctx: CanvasRenderingContext2D,
  C: number,
  z: number,
  dpr: number,
): void {
  const x0 = C * z;
  const size = C * z;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, x0, size, size);
  ctx.clip();

  ctx.fillStyle = "rgba(35,35,32,.05)";
  ctx.fillRect(x0, x0, size, size);

  ctx.strokeStyle = "rgba(35,35,32,.14)";
  ctx.lineWidth = 1;
  const step = Math.max(4, Math.round(3 * dpr));
  ctx.beginPath();
  for (let d = -size; d < size; d += step) {
    ctx.moveTo(x0 + d, x0);
    ctx.lineTo(x0 + d + size, x0 + size);
  }
  ctx.stroke();

  const fontPx = Math.round(9 * dpr);
  if (size >= fontPx * 5) {
    ctx.font = `${fontPx}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(35,35,32,.45)";
    ctx.fillText("locked", x0 + size / 2, x0 + size / 2);
  }
  ctx.restore();
}

/** PNG export — border: the full 3C×3C sheet; tile: the single C×C tile,
 *  optionally through an integer nearest-neighbor upscale (1× is a no-op).
 *  Files export as pattern.png at every scale (BRANDING.md §7). */

import type { PixelBuffer } from "../raster/buffer";
import { scaleUp } from "../raster/buffer";
import { bufferToDataURI } from "../preview/compose";

export function downloadPNG(b: PixelBuffer, scale = 1): void {
  const a = document.createElement("a");
  a.download = "pattern.png";
  a.href = bufferToDataURI(scaleUp(b, scale));
  a.click();
}

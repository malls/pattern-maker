/** PNG export — border: the full 3C×3C sheet; tile: the single C×C tile.
 *  Files export as pattern.png (BRANDING.md §7). */

import type { PixelBuffer } from "../raster/buffer";
import { bufferToDataURI } from "../preview/compose";

export function downloadPNG(b: PixelBuffer): void {
  const a = document.createElement("a");
  a.download = "pattern.png";
  a.href = bufferToDataURI(b);
  a.click();
}

/** CSS snippet generation + clipboard copy.
 *
 * `unit` throughout is cell size × export scale — the slice/tile size in the
 * emitted image's own pixels. border-image-slice is unitless, so it must be
 * measured in the raster the URI actually carries, never in cell sizes. */

export function borderCSS(uri: string, unit: number): string {
  return [
    ".bordered {",
    `  border: ${unit}px solid transparent;`,
    `  border-image: url("${uri}") ${unit} round; /* repeat | stretch | space also work */`,
    "  image-rendering: pixelated;",
    "}",
    "",
  ].join("\n");
}

export function tileCSS(uri: string, unit: number): string {
  return [
    ".tiled {",
    `  background-image: url("${uri}");`,
    "  background-repeat: repeat;",
    `  background-size: ${unit * 4}px ${unit * 4}px; /* 4× zoom so the pixels read; ${unit}px is 1:1 */`,
    "  image-rendering: pixelated;",
    "}",
    "",
  ].join("\n");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

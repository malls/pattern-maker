/** CSS snippet generation + clipboard copy. */

export function borderCSS(uri: string, cellSize: number): string {
  return [
    ".bordered {",
    `  border: ${cellSize}px solid transparent;`,
    `  border-image: url("${uri}") ${cellSize} round; /* repeat | stretch | space also work */`,
    "  image-rendering: pixelated;",
    "}",
    "",
  ].join("\n");
}

export function tileCSS(uri: string, cellSize: number): string {
  return [
    ".tiled {",
    `  background-image: url("${uri}");`,
    "  background-repeat: repeat;",
    `  background-size: ${cellSize * 4}px ${cellSize * 4}px; /* 4× zoom so the pixels read; drop for 1:1 */`,
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

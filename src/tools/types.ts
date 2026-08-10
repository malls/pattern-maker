/** Tool interface. Tools are dumb gesture machines: they receive logical view
 *  coordinates and emit through the ToolContext; all mode semantics (center
 *  lock, torus wrap) live behind ctx.plot / ctx.fill. */

export interface Pt {
  x: number;
  y: number;
}

export interface ToolContext {
  /** logical view size L (both modes' views are L×L) */
  readonly size: number;
  /** plot the current color at a view coordinate */
  plot(x: number, y: number): void;
  /** plot transparency (0x00000000) at a view coordinate */
  erase(x: number, y: number): void;
  /** flood fill the current color at a view coordinate */
  fill(x: number, y: number): boolean;
  /** pick the color under a view coordinate into the current color */
  pick(x: number, y: number): void;
  /** snapshot the active buffer (shape preview) */
  snapshot(): void;
  /** restore the last snapshot */
  restore(): void;
  /** push an undo entry — call before the first mutation of a gesture */
  beginStroke(): void;
  /** finish a gesture: triggers preview regeneration + autosave */
  commit(): void;
}

export interface Tool {
  readonly id: string;
  readonly hotkey: string;
  readonly label: string;
  readonly tip: string;
  onDown(p: Pt, ctx: ToolContext): void;
  onMove(p: Pt, ctx: ToolContext): void;
  onUp(p: Pt, ctx: ToolContext): void;
}

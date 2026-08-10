/** Tool interface. Tools are dumb gesture machines: they receive logical view
 *  coordinates and emit through the ToolContext; all mode semantics (center
 *  lock, torus wrap) live behind ctx.plot / ctx.fill. */

import type { SelRect } from "../state/selection";

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
  /** live-update the marquee rect during a drag (normalized); null deselects */
  setSelection(r: SelRect | null): void;
  getSelection(): SelRect | null;
  /** the floating paste's geometry, or null */
  getFloat(): { x: number; y: number; w: number; h: number } | null;
  /** move the float (clamped to the visible window by the implementation) */
  moveFloatTo(x: number, y: number): void;
  /** stamp the float into the doc — one undo entry */
  stampFloat(): void;
}

export interface Tool {
  readonly id: string;
  readonly hotkey: string;
  readonly label: string;
  readonly tip: string;
  /** never mutates the doc: gestures bump dirtySel, not dirtyDoc (so marquee
   *  drags don't churn previews / autosave) */
  readonly passive?: true;
  /** toPt clamps to the visible window even in focused tile mode (no raw
   *  margin — a marquee beyond the window would mark what you can't see) */
  readonly clampToWindow?: true;
  onDown(p: Pt, ctx: ToolContext): void;
  onMove(p: Pt, ctx: ToolContext): void;
  onUp(p: Pt, ctx: ToolContext): void;
}

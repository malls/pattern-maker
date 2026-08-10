/** Top rail: tool keys with LEDs, mode toggle bank, cell-size stepper. */

import { h } from "./dom";

/* Inline SVG line icons — stroke 1.6, currentColor (BRANDING.md §6). */
const ICONS: Record<string, string> = {
  pencil:
    '<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 18l1-4L15 4l3 3L8 17l-4 1z"/><path d="M13 6l3 3"/></svg>',
  eraser:
    '<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 17l-4-4 8-8 5 5-7 7H8z"/><path d="M4 17h14" stroke-linecap="round"/></svg>',
  line:
    '<svg viewBox="0 0 22 22" stroke="currentColor" stroke-width="1.8"><path d="M4 18L18 4"/></svg>',
  rect:
    '<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="6" width="14" height="10"/></svg>',
  ellipse:
    '<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.6"><ellipse cx="11" cy="11" rx="7" ry="5"/></svg>',
  fill:
    '<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M11 3l7 7-6 6a2.5 2.5 0 01-3.6 0L5 12.6a2.5 2.5 0 010-3.6L11 3z"/><path d="M18 14c1 1.4 1.6 2.4 1.6 3.2a1.6 1.6 0 11-3.2 0c0-.8.6-1.8 1.6-3.2z" fill="currentColor"/></svg>',
  eyedropper:
    '<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12.6 6.4L4.8 14.2 4 18l3.8-.8 7.8-7.8"/><path d="M11.8 5.6l1.8-1.8a2.05 2.05 0 012.9 0l1.7 1.7a2.05 2.05 0 010 2.9l-1.8 1.8-4.6-4.6z"/></svg>',
  /* zoom-to-cell: four corner brackets converging on one small square */
  focus:
    '<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 8V4h4"/><path d="M14 4h4v4"/><path d="M18 14v4h-4"/><path d="M8 18H4v-4"/><rect x="8.5" y="8.5" width="5" height="5"/></svg>',
};

export interface ToolbarSpec {
  tools: readonly { id: string; hotkey: string; label: string }[];
  handlers: {
    onTool(id: string): void;
    onMode(mode: string): void;
    onCellStep(dir: -1 | 1): void;
    onFocus(): void;
  };
}

export interface ToolbarView {
  root: HTMLElement;
  sync(state: { tool: string; mode: string; cellSize: number; focus: boolean }): void;
}

export function createToolbar(spec: ToolbarSpec): ToolbarView {
  const toolKeys = new Map<string, HTMLButtonElement>();
  const toolGroup = h("div", { className: "tb-group", attrs: { role: "toolbar", "aria-label": "tools" } });
  toolGroup.append(h("span", { className: "tb-label", text: "tools" }));
  for (const t of spec.tools) {
    const key = h("button", {
      className: "key tool",
      title: `${t.label} (${t.hotkey})`,
      html: ICONS[t.id] ?? "",
      attrs: { "aria-label": t.label, "aria-pressed": "false", "data-tool": t.id },
    });
    key.append(h("i", { className: "led", attrs: { "aria-hidden": "true" } }));
    key.addEventListener("click", () => spec.handlers.onTool(t.id));
    toolKeys.set(t.id, key);
    toolGroup.append(key);
  }

  const modeKeys = new Map<string, HTMLButtonElement>();
  const modeGroup = h("div", { className: "tb-group", attrs: { role: "group", "aria-label": "mode" } });
  modeGroup.append(h("span", { className: "tb-label", text: "mode" }));
  const bank = h("div", { className: "mode-bank" });
  for (const m of [
    { id: "border", hotkey: "1" },
    { id: "tile", hotkey: "2" },
  ]) {
    const key = h("button", {
      className: "key",
      text: m.id,
      title: `${m.id} mode (${m.hotkey})`,
      attrs: { "aria-pressed": "false" },
    });
    key.addEventListener("click", () => spec.handlers.onMode(m.id));
    modeKeys.set(m.id, key);
    bank.append(key);
  }
  modeGroup.append(bank);

  const readout = h("span", { className: "readout", text: "016", attrs: { "aria-live": "polite" } });
  const minus = h("button", { className: "key", text: "−", title: "smaller cell", attrs: { "aria-label": "smaller cell" } });
  const plus = h("button", { className: "key", text: "+", title: "larger cell", attrs: { "aria-label": "larger cell" } });
  minus.addEventListener("click", () => spec.handlers.onCellStep(-1));
  plus.addEventListener("click", () => spec.handlers.onCellStep(1));
  const cellGroup = h("div", { className: "tb-group", attrs: { role: "group", "aria-label": "cell size" } });
  cellGroup.append(h("span", { className: "tb-label", text: "cell" }));
  const stepper = h("div", { className: "stepper" }, minus, readout, plus);
  cellGroup.append(stepper);

  // view group: the focus key — a state key (synced from focus, not a tool)
  const focusKey = h("button", {
    className: "key tool",
    title: "focus one cell (z)",
    html: ICONS["focus"] ?? "",
    attrs: { "aria-label": "focus one cell", "aria-pressed": "false" },
  });
  focusKey.append(h("i", { className: "led", attrs: { "aria-hidden": "true" } }));
  focusKey.addEventListener("click", () => spec.handlers.onFocus());
  const viewGroup = h("div", { className: "tb-group", attrs: { role: "group", "aria-label": "view" } });
  viewGroup.append(h("span", { className: "tb-label", text: "view" }), focusKey);

  const root = h("div", { className: "toolbar" }, toolGroup, modeGroup, cellGroup, viewGroup);

  return {
    root,
    sync(state) {
      for (const [id, key] of toolKeys) {
        key.setAttribute("aria-pressed", id === state.tool ? "true" : "false");
      }
      for (const [id, key] of modeKeys) {
        key.setAttribute("aria-pressed", id === state.mode ? "true" : "false");
      }
      readout.textContent = String(state.cellSize).padStart(3, "0");
      focusKey.setAttribute("aria-pressed", state.focus ? "true" : "false");
    },
  };
}

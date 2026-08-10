/** The 16 drawing chips, custom color well, current-color chip. Dumb view:
 *  it is handed a set of swatches and never knows which palette they came
 *  from. */

import { h } from "./dom";

export interface ChipsSpec {
  onColor(hex: string): void;
}

export interface ChipsView {
  root: HTMLElement;
  sync(s: { colorHex: string; swatches: readonly string[] }): void;
}

export function createChips(spec: ChipsSpec): ChipsView {
  const label = h("span", { className: "deck-label", text: "color" });
  const current = h("div", { className: "current", title: "current color" });
  const wrap = h("div", { className: "chips", attrs: { role: "group", "aria-label": "color chips" } });

  /** The set currently painted on the buttons. Handlers read it by index —
   *  never by a captured hex, which would keep painting the old set after a
   *  swatch change. */
  let swatches: readonly string[] = [];
  const buttons: HTMLButtonElement[] = [];

  function addChip(): void {
    const i = buttons.length;
    const b = h("button", { className: "chip", attrs: { "aria-pressed": "false" } });
    b.addEventListener("click", () => {
      const hex = swatches[i];
      if (hex) spec.onColor(hex);
    });
    buttons.push(b);
    wrap.append(b);
  }

  /** Repaint the existing buttons in place. The grid is reconciled, never
   *  rebuilt: a chip holding keyboard focus keeps it across a swatch change. */
  function render(next: readonly string[]): void {
    swatches = next;
    while (buttons.length < next.length) addChip();
    while (buttons.length > next.length) buttons.pop()?.remove();
    for (let i = 0; i < buttons.length; i++) {
      const b = buttons[i];
      const hex = next[i];
      if (!b || !hex) continue;
      b.style.background = hex;
      b.title = hex.toLowerCase();
      b.setAttribute("aria-label", `color ${hex}`);
    }
  }

  const custom = h("input", {
    className: "custom",
    title: "custom color",
    attrs: { type: "color", value: "#FF4E00", "aria-label": "custom color" },
  });
  custom.addEventListener("input", () => spec.onColor(custom.value));

  const root = h("div", { className: "tb-group" }, label, current, wrap, custom);

  return {
    root,
    sync(s) {
      render(s.swatches);
      const lower = s.colorHex.toLowerCase();
      current.style.background = s.colorHex;
      // the ring means "this chip is the current color" — if none is, none
      // claims to be. The current color itself is never touched from here.
      for (let i = 0; i < buttons.length; i++) {
        const hex = swatches[i];
        buttons[i]?.setAttribute(
          "aria-pressed",
          hex !== undefined && hex.toLowerCase() === lower ? "true" : "false",
        );
      }
    },
  };
}

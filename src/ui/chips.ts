/** The 16 brand drawing chips, custom color well, current-color chip. */

import { h } from "./dom";

/* Part of the brand — BRANDING.md §3, demo CHIPS array verbatim. */
export const CHIPS: readonly string[] = [
  "#232320", "#575651", "#8B8A85", "#C6C5BF",
  "#FBFAF8", "#EFE6D0", "#8A5A3B", "#FF4E00",
  "#D22E2E", "#F2B500", "#3E9B4F", "#2E8B8B",
  "#2E5FD2", "#7B4FD2", "#C43E8F", "#F2A0B8",
];

export interface ChipsView {
  root: HTMLElement;
  sync(colorHex: string): void;
}

export function createChips(onColor: (hex: string) => void): ChipsView {
  const label = h("span", { className: "deck-label", text: "color" });
  const current = h("div", { className: "current", title: "current color" });
  const wrap = h("div", { className: "chips", attrs: { role: "group", "aria-label": "color chips" } });
  const buttons = new Map<string, HTMLButtonElement>();
  for (const hex of CHIPS) {
    const b = h("button", {
      className: "chip",
      title: hex.toLowerCase(),
      attrs: { "aria-label": `color ${hex}`, "aria-pressed": "false" },
    });
    b.style.background = hex;
    b.addEventListener("click", () => onColor(hex));
    buttons.set(hex.toLowerCase(), b);
    wrap.append(b);
  }
  const custom = h("input", {
    className: "custom",
    title: "custom color",
    attrs: { type: "color", value: "#FF4E00", "aria-label": "custom color" },
  });
  custom.addEventListener("input", () => onColor(custom.value));

  const root = h("div", { className: "tb-group" }, label, current, wrap, custom);

  return {
    root,
    sync(colorHex) {
      const lower = colorHex.toLowerCase();
      current.style.background = colorHex;
      for (const [hex, b] of buttons) {
        b.setAttribute("aria-pressed", hex === lower ? "true" : "false");
      }
    },
  };
}

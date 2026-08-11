/** The chip sets the deck can show. Pure data — no DOM, no imports, so
 *  persistence can validate an id without reaching into ui/.
 *
 *  Every palette is 16 swatches in fixed roles (the slot contract, BRANDING.md
 *  §3): slots 0–4 are the value spine dark → light, slot 0 is the palette's
 *  ink, slot 4 is `#FBFAF8` — the --paper token, identical in every palette
 *  (you print onto one stock; the inks change). Slots 5–15 are the eleven
 *  colors: wash, earth, accent, then the hue wheel — except `rainbow` and
 *  `neon`, which spend all eleven on one sweep, on purpose. */

export type PaletteId = "shop" | "mono" | "pastel" | "gem" | "rainbow" | "neon";

export interface Palette {
  readonly id: PaletteId;
  /** what the deck readout shows — lowercase, one word */
  readonly label: string;
  /** LCD line printed on every switch */
  readonly tip: string;
  /** exactly 16, in slot order (left to right, top row then bottom) */
  readonly swatches: readonly string[];
}

/** The house set: restrained industrial, screen-print flavored. Named so the
 *  total lookup below has something to fall back to without an assertion. */
const SHOP: Palette = {
  id: "shop",
  label: "shop",
  tip: "shop inks. the house set",
  /* Part of the brand — BRANDING.md §3, demo CHIPS array verbatim. */
  swatches: [
    "#232320", "#575651", "#8B8A85", "#C6C5BF",
    "#FBFAF8", "#EFE6D0", "#8A5A3B", "#FF4E00",
    "#D22E2E", "#F2B500", "#3E9B4F", "#2E8B8B",
    "#2E5FD2", "#7B4FD2", "#C43E8F", "#F2A0B8",
  ],
};

/** Stepper order: quiet → loud. */
export const PALETTES: readonly Palette[] = [
  SHOP,
  {
    id: "mono",
    label: "mono",
    tip: "mono. value does the work",
    /* Warm-biased on purpose — every gray in this brand holds R > G > B, and a
     * neutral ramp would be the one place the grays disagree. The fine steps
     * are close together because that is what monochrome is for. */
    swatches: [
      "#232320", "#575651", "#8B8A85", "#C6C5BF",
      "#FBFAF8", "#2E2D29", "#3C3B36", "#4A4944",
      "#626159", "#767570", "#9C9B95", "#ADACA6",
      "#BDBCB6", "#D3D2CC", "#E0DFD9", "#EDEBE5",
    ],
  },
  {
    id: "pastel",
    label: "pastel",
    tip: "pastel. quiet on purpose",
    /* Spine tinted lilac; the ink is a violet-charcoal, dark enough to draw
     * with but not a hard black — a pastel set with black in it isn't one. */
    swatches: [
      "#3B3742", "#6F6A78", "#A9A2AE", "#D8D3DC",
      "#FBFAF8", "#F7E9E0", "#C39B87", "#F0907A",
      "#F0A3A0", "#F2DFA0", "#B3D6A8", "#A3D2CE",
      "#A8BEE0", "#C0B2E0", "#E0AFD1", "#F5C6D3",
    ],
  },
  {
    id: "gem",
    label: "gem",
    tip: "gem tones. deep and expensive",
    /* Obsidian ink, slate spine, pearl wash, bronze earth, topaz accent, then
     * the stones. Deep-and-slightly-dirty — still nothing neon. */
    swatches: [
      "#14161A", "#2B3038", "#4A525E", "#9AA2AC",
      "#FBFAF8", "#E7E9ED", "#7E5F2E", "#C4711A",
      "#8E1F32", "#C99A21", "#1D6E4E", "#17696E",
      "#1E3F8F", "#5B2E8F", "#961C63", "#C4708C",
    ],
  },
  {
    id: "rainbow",
    label: "rainbow",
    tip: "rainbow. the css keywords, straight",
    /* Every swatch here is a CSS named color, spelled exactly: the spine is
     * black/dimgray/gray/silver, then eleven hue keywords in one sweep. These
     * values must stay exact — a near-value would make the name a lie. Paper
     * stays #FBFAF8 (the stock does not change with the inks). */
    swatches: [
      "#000000", "#696969", "#808080", "#C0C0C0", // black, dimgray, gray, silver
      "#FBFAF8", "#FF0000", "#FF4500", "#FFA500", // paper, red, orangered, orange
      "#FFD700", "#FFFF00", "#00FF00", "#008000", // gold, yellow, lime, green
      "#00FFFF", "#0000FF", "#4B0082", "#FF00FF", // cyan, blue, indigo, magenta
    ],
  },
  {
    id: "neon",
    label: "neon",
    tip: "neon. loud on a dark ground",
    /* The one palette with a cool spine: a blue-violet near-black rather than
     * the brand's warm grays, because neon on warm putty reads muddy. Eleven
     * hues in the same ordered sweep as rainbow. */
    swatches: [
      "#0B0B12", "#1E1B2E", "#4A4468", "#8F86B8", // spine: ink → dusk
      "#FBFAF8", "#FF1D58", "#FF6B00", "#FFD400", // paper, rose, orange, yellow
      "#C6FF00", "#39FF14", "#00FFC6", "#00E5FF", // acid, green, mint, cyan
      "#00A3FF", "#4D5BFF", "#B026FF", "#FF00E5", // azure, blue, purple, magenta
    ],
  },
];

/** The house set, and the set the demo ships. */
export const DEFAULT_PALETTE: PaletteId = "shop";

export function isPaletteId(v: unknown): v is PaletteId {
  return typeof v === "string" && PALETTES.some((p) => p.id === v);
}

/** Total — an unknown id resolves to the house set rather than throwing. */
export function paletteById(id: PaletteId): Palette {
  return PALETTES.find((p) => p.id === id) ?? SHOP;
}

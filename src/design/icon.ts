import { COLORS } from "./tokens.ts";

// SPEC-065 CA-4 (ADR-029 §4): one bar, the block of the wordmark (8 × 19,
// rx 2.5 on the 48 grid) scaled × 1.35 and centred on (24, 24). Seeds A/B/C
// of docs/diseno/Marca.dc.html are history. Colours from COLORS only.
// tools/icons.mjs rasterises the dark variant into public/.

export const ICON_GRID = 48;

// The files served from public/ and their sizes (px).
export const ICON_FILES = {
  favicon: { path: "favicon.ico", sizes: [16, 32] },
  icon: { path: "icon-32.png", sizes: [32] },
  apple: { path: "apple-touch-icon.png", sizes: [180] },
  pwa192: { path: "icon-192.png", sizes: [192] },
  pwa512: { path: "icon-512.png", sizes: [512] },
} as const;

// `dark`: the bar in the brand on the bg tile (the site's icons).
// `brand`: the bar in bg on a brand tile (the variant for social networks).
export type IconVariant = "dark" | "brand";

const SCALE = 1.35;
const BAR = {
  width: 8 * SCALE,
  height: 19 * SCALE,
  rx: 2.5 * SCALE,
} as const;
// Rounded to the grid's thousandths: 18.6, 11.175, 10.8, 25.65, 3.375.
const n = (v: number): string => String(Math.round(v * 1000) / 1000);

// `rounded`: the 48 grid's rounded tile with its hairline, as in the design.
// The apple-touch-icon is a full square: iOS rounds it itself, and a
// transparent corner would turn black there.
export function iconSvg({
  rounded,
  variant = "dark",
}: {
  rounded: boolean;
  variant?: IconVariant;
}): string {
  const fill = variant === "brand" ? COLORS.brand.value : COLORS.bg.value;
  const bar = variant === "brand" ? COLORS.bg.value : COLORS.brand.value;
  const tile = rounded
    ? `<rect width="48" height="48" rx="11" fill="${fill}"/>` +
      `<rect x="0.5" y="0.5" width="47" height="47" rx="10.5" fill="none" stroke="${COLORS.line.value}"/>`
    : `<rect width="48" height="48" fill="${fill}"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ICON_GRID} ${ICON_GRID}">` +
    tile +
    `<rect x="${n(24 - BAR.width / 2)}" y="${n(24 - BAR.height / 2)}" width="${n(BAR.width)}" height="${n(BAR.height)}" rx="${n(BAR.rx)}" fill="${bar}"/>` +
    "</svg>"
  );
}

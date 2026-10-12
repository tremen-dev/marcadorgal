import { COLORS } from "./tokens.ts";

// SPEC-033 CA-6 (H-6): the icon is seed B, «O bloque», of
// docs/diseno/Marca.dc.html, drawn on its 48 grid: the ▮ of the logotype,
// the bar that lights up in the brand green beside a still one. Colours from
// COLORS only. tools/icons.mjs rasterises it into public/.

export const ICON_GRID = 48;

// The files served from public/ and their sizes (px).
export const ICON_FILES = {
  favicon: { path: "favicon.ico", sizes: [16, 32] },
  icon: { path: "icon-32.png", sizes: [32] },
  apple: { path: "apple-touch-icon.png", sizes: [180] },
} as const;

// `rounded`: the 48 grid's rounded tile with its hairline, as in the design.
// The apple-touch-icon is a full square: iOS rounds it itself, and a
// transparent corner would turn black there.
export function iconSvg({ rounded }: { rounded: boolean }): string {
  const tile = rounded
    ? `<rect width="48" height="48" rx="11" fill="${COLORS.bg.value}"/>` +
      `<rect x="0.5" y="0.5" width="47" height="47" rx="10.5" fill="none" stroke="${COLORS.line.value}"/>`
    : `<rect width="48" height="48" fill="${COLORS.bg.value}"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ICON_GRID} ${ICON_GRID}">` +
    tile +
    `<rect x="14" y="10" width="8" height="28" rx="2.5" fill="${COLORS.fg.value}"/>` +
    `<rect x="26" y="19" width="8" height="19" rx="2.5" fill="${COLORS.brand.value}"/>` +
    "</svg>"
  );
}

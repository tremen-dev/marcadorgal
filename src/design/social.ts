import { type IconVariant, iconSvg } from "./icon.ts";
import { COLORS, FAMILIES } from "./tokens.ts";

// SPEC-064 (ADR-028): the pieces for social networks and the Open Graph card,
// one catalogue and the pages that paint them. Pure: tools/redes.mjs and
// tools/og-image.mjs pass in the @font-face rules (Geist from public/fonts/)
// and rasterise the pages with Playwright's Chromium. Colours from COLORS only.
//
// `dark`: bg background, the bar in the brand. `brand`: brand background, the
// bar in bg. The two variants of a profile picture are files `-oscuro` and
// `-celeste`; neither is the main one (the owner picks it, SPEC-064 CA-6).

export type SafeZone =
  | { readonly kind: "circle"; cx: number; cy: number; r: number }
  | { readonly kind: "rect"; x0: number; y0: number; x1: number; y1: number };

// `og`: the Open Graph card. `icon`: the bar alone, for circular crops.
// `banner`: the bar beside the wordmark and the domain. `poster`: the same,
// stacked.
export type SocialLayout = "og" | "icon" | "banner" | "poster";

export type SocialAsset = {
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly variant: IconVariant;
  readonly crop: "circle" | "rect";
  readonly safe: SafeZone;
  readonly layout: SocialLayout;
};

const rect = (x0: number, y0: number, x1: number, y1: number): SafeZone => ({
  kind: "rect",
  x0,
  y0,
  x1,
  y1,
});

// Circular crops: everything within 0.40 × the width of the centre.
const circle = (base: string, width: number, height = width): SocialAsset[] =>
  (
    [
      ["oscuro", "dark"],
      ["celeste", "brand"],
    ] as const
  ).map(([suffix, variant]) => ({
    path: `assets/redes/${base}-${suffix}.png`,
    width,
    height,
    variant,
    crop: "circle",
    safe: { kind: "circle", cx: width / 2, cy: height / 2, r: 0.4 * width },
    layout: "icon",
  }));

const piece = (
  path: string,
  width: number,
  height: number,
  layout: SocialLayout,
  safe: SafeZone,
): SocialAsset => ({
  path,
  width,
  height,
  variant: "dark",
  crop: "rect",
  safe,
  layout,
});

// Served by the site (SPEC-050 CA-3); inside its 24 px frame.
export const OG_ASSET: SocialAsset = piece(
  "public/og.png",
  1200,
  630,
  "og",
  rect(24, 24, 1176, 606),
);

export const SOCIAL_ASSETS: readonly SocialAsset[] = [
  OG_ASSET,
  ...circle("x-avatar", 400),
  // Clear of the avatar that X lays over the bottom left.
  piece(
    "assets/redes/x-header.png",
    1500,
    500,
    "banner",
    rect(360, 90, 1140, 410),
  ),
  ...circle("ig-perfil", 1080),
  // The profile grid shows the 4:5 post cropped to 3:4.
  piece(
    "assets/redes/ig-post-1080x1080.png",
    1080,
    1080,
    "poster",
    rect(108, 108, 972, 972),
  ),
  piece(
    "assets/redes/ig-post-1080x1350.png",
    1080,
    1350,
    "poster",
    rect(135, 135, 945, 1215),
  ),
  // Clear of the story's top bar and reply field.
  piece(
    "assets/redes/ig-story.png",
    1080,
    1920,
    "poster",
    rect(90, 250, 990, 1670),
  ),
  ...circle("ig-destacada", 1080, 1920),
  ...circle("whatsapp-perfil", 640),
  ...circle("bluesky-avatar", 1000),
  piece(
    "assets/redes/bluesky-banner.png",
    3000,
    1000,
    "banner",
    rect(720, 180, 2280, 820),
  ),
];

// The bar of the icon (8 × 19, rx 2.5 on the 48 grid), by its height.
const BAR_RATIO = 8 / 19;
const BAR_RADIUS = 2.5 / 19;
const px = (v: number): string => `${Math.round(v * 100) / 100}px`;

const barCss = (selector: string, height: number): string => `
    ${selector} {
      flex: none;
      width: ${px(height * BAR_RATIO)};
      height: ${px(height)};
      border-radius: ${px(height * BAR_RADIUS)};
      background: ${COLORS.brand.value};
    }`;

// The wordmark of SPEC-063 CA-3: the block is drawn, never a glyph.
const WORDMARK = `marcador<span class="block" aria-hidden="true"></span>gal`;
const DOMAIN = "marcador.gal";

const wordmarkCss = (size: number): string => `
    .wordmark {
      font-family: ${FAMILIES.sans};
      font-weight: 800;
      font-size: ${px(size)};
      line-height: 1;
      letter-spacing: -0.045em;
      color: ${COLORS.fg.value};
      white-space: nowrap;
    }
    .block {
      display: inline-block;
      width: 0.3em;
      height: 0.72em;
      margin: 0 0.06em;
      border-radius: 0.095em;
      background: ${COLORS.brand.value};
      vertical-align: baseline;
    }`;

const domainCss = (size: number): string => `
    .domain {
      font-family: ${FAMILIES.mono};
      font-weight: 500;
      font-size: ${px(size)};
      line-height: 1;
      letter-spacing: 0.02em;
      color: ${COLORS.fgMuted.value};
      white-space: nowrap;
    }`;

function page(
  width: number,
  height: number,
  background: string,
  fontCss: string,
  css: string,
  body: string,
): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${fontCss}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: ${width}px;
      height: ${height}px;
    }
    body {
      background: ${background};
      overflow: hidden;
      position: relative;
    }${css}
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

const safeBox = (safe: SafeZone): string =>
  safe.kind === "rect"
    ? `
    .safe {
      position: absolute;
      left: ${safe.x0}px;
      top: ${safe.y0}px;
      width: ${safe.x1 - safe.x0}px;
      height: ${safe.y1 - safe.y0}px;
      display: flex;
      align-items: center;
      justify-content: center;
    }`
    : "";

// The page that paints one piece of SOCIAL_ASSETS other than og.png.
export function socialHtml(asset: SocialAsset, fontCss: string): string {
  const { width, height, variant, safe, layout } = asset;
  const background = variant === "brand" ? COLORS.brand.value : COLORS.bg.value;
  if (layout === "icon") {
    // The square icon, as wide as the piece and centred: its tile is the
    // background, so only the bar shows.
    const svg = iconSvg({ rounded: false, variant }).replace(
      "<svg ",
      `<svg width="${width}" height="${width}" `,
    );
    const css = `
    body {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    svg { display: block; flex: none; }`;
    return page(width, height, background, fontCss, css, svg);
  }
  if (layout === "og") return ogHtml(fontCss);
  if (safe.kind !== "rect") throw new Error(`${asset.path}: needs a rect zone`);
  const lockup = `<div class="safe"><div class="lockup"><div class="bar"></div><div class="words"><div class="wordmark">${WORDMARK}</div><div class="domain">${DOMAIN}</div></div></div></div>`;
  if (layout === "banner") {
    // Sized on the X header's 320 px high zone.
    const u = (safe.y1 - safe.y0) / 320;
    const css = `${safeBox(safe)}
    .lockup {
      display: flex;
      align-items: center;
      gap: ${px(44 * u)};
    }
    .words {
      display: flex;
      flex-direction: column;
      gap: ${px(22 * u)};
    }${barCss(".bar", 230 * u)}${wordmarkCss(90 * u)}${domainCss(30 * u)}`;
    return page(width, height, background, fontCss, css, lockup);
  }
  // poster: sized on a 900 px wide zone.
  const u = (safe.x1 - safe.x0) / 900;
  const css = `${safeBox(safe)}
    .lockup {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: ${px(72 * u)};
    }
    .words {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: ${px(32 * u)};
    }${barCss(".bar", 420 * u)}${wordmarkCss(124 * u)}${domainCss(40 * u)}`;
  return page(width, height, background, fontCss, css, lockup);
}

const OG_PILLS = [
  "1ª División",
  "2ª División",
  "1ª RFEF G1",
  "2ª RFEF G1",
  "3ª RFEF G1",
];

// The Open Graph card (SPEC-050 CA-3): the gl headline and subtitle, the
// competitions, the icon of one bar and the wordmark. No live pill: a still
// image cannot say what is on now, and the brand is never a state (ADR-005).
export function ogHtml(fontCss: string): string {
  const { width, height } = OG_ASSET;
  const css = `
    body {
      color: ${COLORS.fg.value};
      font-family: ${FAMILIES.sans};
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 64px 72px;
    }
    .frame {
      position: absolute;
      inset: 24px;
      border: 1px solid ${COLORS.line.value};
      border-radius: 20px;
    }
    .lockup {
      display: flex;
      align-items: center;
      gap: 18px;
      z-index: 1;
    }
    .tile svg { display: block; width: 56px; height: 56px; }${wordmarkCss(38)}
    .content {
      z-index: 1;
      margin: auto 0;
      display: flex;
      flex-direction: column;
      gap: 18px;
      max-width: 780px;
    }
    .headline {
      font-size: 60px;
      font-weight: 800;
      line-height: 1.08;
      letter-spacing: -0.04em;
      color: ${COLORS.fg.value};
    }
    .description {
      font-size: 25px;
      font-weight: 500;
      line-height: 1.4;
      color: ${COLORS.fgMuted.value};
    }${barCss(".hero", 300)}
    .hero {
      position: absolute;
      right: 136px;
      top: 150px;
    }
    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 1;
      padding-top: 24px;
      border-top: 1px solid ${COLORS.line.value};
    }
    .competitions {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .pill {
      padding: 8px 14px;
      background: ${COLORS.bgElevated.value};
      border: 1px solid ${COLORS.line.value};
      border-radius: 8px;
      font-family: ${FAMILIES.mono};
      font-size: 15px;
      font-weight: 500;
      color: ${COLORS.fg.value};
    }${domainCss(16)}
    .domain { color: ${COLORS.fgDim.value}; }`;
  const body = `<div class="frame"></div>
<div class="lockup"><div class="tile">${iconSvg({ rounded: true })}</div><div class="wordmark">${WORDMARK}</div></div>
<div class="hero"></div>
<div class="content">
  <h1 class="headline">Todo o fútbol galego nunha pantalla</h1>
  <p class="description">Resultados en directo nun golpe de vista</p>
</div>
<div class="footer">
  <div class="competitions">${OG_PILLS.map((p) => `<span class="pill">${p}</span>`).join("")}</div>
  <div class="domain">${DOMAIN}</div>
</div>`;
  return page(width, height, COLORS.bg.value, fontCss, css, body);
}

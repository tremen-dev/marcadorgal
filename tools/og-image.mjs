// SPEC-050 CA-3: generates public/og.png (1200x630 px) for social sharing cards
// (WhatsApp, Twitter/X, Telegram) from design tokens and self-hosted Geist fonts.
// Usage: node tools/og-image.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { COLORS } from "../src/design/tokens.ts";

const publicDir = fileURLToPath(new URL("../public/", import.meta.url));

const geistExtraBold = readFileSync(
  `${publicDir}fonts/Geist-ExtraBold.woff2`,
).toString("base64");
const geistMedium = readFileSync(
  `${publicDir}fonts/Geist-Medium.woff2`,
).toString("base64");
const geistMono = readFileSync(
  `${publicDir}fonts/GeistMono-Medium.woff2`,
).toString("base64");

const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @font-face {
      font-family: 'Geist';
      font-weight: 800;
      src: url('data:font/woff2;base64,${geistExtraBold}') format('woff2');
    }
    @font-face {
      font-family: 'Geist';
      font-weight: 500;
      src: url('data:font/woff2;base64,${geistMedium}') format('woff2');
    }
    @font-face {
      font-family: 'Geist Mono';
      font-weight: 500;
      src: url('data:font/woff2;base64,${geistMono}') format('woff2');
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 1200px;
      height: 630px;
      background: ${COLORS.bg.value};
      color: ${COLORS.fg.value};
      font-family: 'Geist', ui-sans-serif, system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 64px 72px;
      overflow: hidden;
      position: relative;
    }
    /* Subtle decorative grid/line on background */
    .frame {
      position: absolute;
      inset: 24px;
      border: 1px solid ${COLORS.line.value};
      border-radius: 20px;
      pointer-events: none;
    }
    .top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 1;
    }
    .brand-lockup {
      display: flex;
      align-items: center;
      gap: 18px;
    }
    .logo-text {
      font-size: 38px;
      font-weight: 800;
      letter-spacing: -0.045em;
      color: ${COLORS.fg.value};
    }
    .logo-block {
      color: ${COLORS.brand.value};
      margin: 0 1px;
    }
    .badge-live {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: ${COLORS.bgElevated.value};
      border: 1px solid ${COLORS.lineStrong.value};
      border-radius: 999px;
      font-family: 'Geist Mono', monospace;
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: ${COLORS.brand.value};
    }
    .badge-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: ${COLORS.brand.value};
    }
    .content {
      z-index: 1;
      margin: auto 0;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .headline {
      font-size: 60px;
      font-weight: 800;
      line-height: 1.08;
      letter-spacing: -0.04em;
      color: ${COLORS.fg.value};
      max-width: 980px;
    }
    .description {
      font-size: 25px;
      font-weight: 500;
      line-height: 1.4;
      color: ${COLORS.fgMuted.value};
      max-width: 900px;
    }
    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 1;
      padding-top: 24px;
      border-top: 1px solid ${COLORS.line.value};
    }
    .categories {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .category-pill {
      padding: 8px 14px;
      background: ${COLORS.bgElevated.value};
      border: 1px solid ${COLORS.line.value};
      border-radius: 8px;
      font-family: 'Geist Mono', monospace;
      font-size: 15px;
      font-weight: 500;
      color: ${COLORS.fg.value};
    }
    .url {
      font-family: 'Geist Mono', monospace;
      font-size: 16px;
      font-weight: 500;
      color: ${COLORS.fgDim.value};
    }
  </style>
</head>
<body>
  <div class="frame"></div>
  <div class="top-bar">
    <div class="brand-lockup">
      <!-- Seed B icon tile -->
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="48" height="48" rx="11" fill="${COLORS.bgElevated.value}"/>
        <rect x="0.5" y="0.5" width="47" height="47" rx="10.5" stroke="${COLORS.lineStrong.value}"/>
        <rect x="14" y="10" width="8" height="28" rx="2.5" fill="${COLORS.fg.value}"/>
        <rect x="26" y="19" width="8" height="19" rx="2.5" fill="${COLORS.brand.value}"/>
      </svg>
      <div class="logo-text">marcador<span class="logo-block">▮</span>gal</div>
    </div>
    <div class="badge-live">
      <div class="badge-dot"></div>
      En xogo
    </div>
  </div>

  <div class="content">
    <h1 class="headline">Todo o fútbol galego nunha pantalla</h1>
    <p class="description">Resultados galegos en directo de 1ª, 2ª, 1ª RFEF, 2ª RFEF e 3ª RFEF</p>
  </div>

  <div class="footer">
    <div class="categories">
      <span class="category-pill">1ª División</span>
      <span class="category-pill">2ª División</span>
      <span class="category-pill">1ª RFEF G1</span>
      <span class="category-pill">2ª RFEF G1</span>
      <span class="category-pill">3ª RFEF G1</span>
    </div>
    <div class="url">marcador.gal</div>
  </div>
</body>
</html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(html, { waitUntil: "networkidle" });
  const png = await page.screenshot({
    type: "png",
    clip: { x: 0, y: 0, width: 1200, height: 630 },
  });
  writeFileSync(`${publicDir}og.png`, png);
  console.log(`og: wrote ${publicDir}og.png (${png.length} bytes)`);
} finally {
  await browser.close();
}

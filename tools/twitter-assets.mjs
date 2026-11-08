// Generates Twitter/X assets from design tokens:
// 1. public/twitter-avatar.png (400x400 px, circular-safe)
// 2. public/twitter-header.png (1500x500 px, banner with safe area)
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

const fontStyles = `
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
`;

const avatarHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 400px;
      height: 400px;
      background: ${COLORS.bg.value};
      display: flex;
      align-items: center;
      justify-content: center;
    }
  </style>
</head>
<body>
  <svg width="220" height="220" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="14" y="10" width="8" height="28" rx="2.5" fill="${COLORS.fg.value}"/>
    <rect x="26" y="19" width="8" height="19" rx="2.5" fill="${COLORS.brand.value}"/>
  </svg>
</body>
</html>`;

const headerHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${fontStyles}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 1500px;
      height: 500px;
      background: ${COLORS.bg.value};
      color: ${COLORS.fg.value};
      font-family: 'Geist', sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 40px 60px;
      position: relative;
      overflow: hidden;
    }
    .frame {
      position: absolute;
      inset: 20px;
      border: 1px solid ${COLORS.line.value};
      border-radius: 16px;
      pointer-events: none;
    }
    .brand-lockup {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
    }
    .logo-text {
      font-size: 38px;
      font-weight: 800;
      letter-spacing: -0.045em;
      color: ${COLORS.fg.value};
    }
    /* SPEC-063 CA-3: the block is drawn, not a glyph (the art is SPEC-064's). */
    .logo-block {
      display: inline-block;
      width: 0.3em;
      height: 0.72em;
      margin: 0 0.06em;
      border-radius: 0.095em;
      background: ${COLORS.brand.value};
    }
    .headline {
      font-size: 58px;
      font-weight: 800;
      letter-spacing: -0.035em;
      line-height: 1.1;
      margin-bottom: 16px;
      color: ${COLORS.fg.value};
    }
    .subtitle {
      font-size: 24px;
      font-weight: 500;
      color: ${COLORS.fgMuted.value};
      margin-bottom: 32px;
    }
    .categories {
      display: flex;
      gap: 12px;
    }
    .pill {
      padding: 8px 16px;
      background: ${COLORS.bgElevated.value};
      border: 1px solid ${COLORS.line.value};
      border-radius: 8px;
      font-family: 'Geist Mono', monospace;
      font-size: 15px;
      font-weight: 500;
      color: ${COLORS.fg.value};
    }
  </style>
</head>
<body>
  <div class="frame"></div>
  <div class="brand-lockup">
    <svg width="44" height="44" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="11" fill="${COLORS.bgElevated.value}"/>
      <rect x="0.5" y="0.5" width="47" height="47" rx="10.5" stroke="${COLORS.lineStrong.value}"/>
      <rect x="14" y="10" width="8" height="28" rx="2.5" fill="${COLORS.fg.value}"/>
      <rect x="26" y="19" width="8" height="19" rx="2.5" fill="${COLORS.brand.value}"/>
    </svg>
    <div class="logo-text">marcador<span class="logo-block" aria-hidden="true"></span>gal</div>
  </div>
  <h1 class="headline">Todo o fútbol galego nunha pantalla</h1>
  <p class="subtitle">Resultados en directo nun golpe de vista</p>
  <div class="categories">
    <span class="pill">1ª División</span>
    <span class="pill">2ª División</span>
    <span class="pill">1ª RFEF G1</span>
    <span class="pill">2ª RFEF G1</span>
    <span class="pill">3ª RFEF G1</span>
  </div>
</body>
</html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });

  // 1. Avatar
  await page.setViewportSize({ width: 400, height: 400 });
  await page.setContent(avatarHtml, { waitUntil: "networkidle" });
  const avatar = await page.screenshot({ type: "png" });
  writeFileSync(`${publicDir}twitter-avatar.png`, avatar);
  console.log(`avatar: wrote ${publicDir}twitter-avatar.png`);

  // 2. Header
  await page.setViewportSize({ width: 1500, height: 500 });
  await page.setContent(headerHtml, { waitUntil: "networkidle" });
  const header = await page.screenshot({ type: "png" });
  writeFileSync(`${publicDir}twitter-header.png`, header);
  console.log(`header: wrote ${publicDir}twitter-header.png`);
} finally {
  await browser.close();
}

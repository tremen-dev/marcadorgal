// SPEC-064: the shared rendering helpers of tools/redes.mjs and
// tools/og-image.mjs. The pages come from src/design/social.ts; here only the
// self-hosted Geist faces (public/fonts/, FACES) and Playwright's Chromium.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { FACES } from "../src/design/tokens.ts";

export const root = fileURLToPath(new URL("../", import.meta.url));

// Every face as a data: URL, so the page needs no network.
export function fontCss() {
  return FACES.map(({ family, weight, file }) => {
    const data = readFileSync(`${root}public/fonts/${file}`).toString("base64");
    return `@font-face { font-family: '${family}'; font-weight: ${weight}; src: url('data:font/woff2;base64,${data}') format('woff2'); }`;
  }).join("\n    ");
}

export async function withPage(fn) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    return await fn(page);
  } finally {
    await browser.close();
  }
}

// One PNG of exactly width × height px, once the faces have loaded.
export async function renderPng(page, html, width, height) {
  await page.setViewportSize({ width, height });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  return page.screenshot({
    type: "png",
    clip: { x: 0, y: 0, width, height },
  });
}

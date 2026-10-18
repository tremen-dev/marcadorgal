// SPEC-033 CA-6: writes public/favicon.ico, public/icon-32.png and
// public/apple-touch-icon.png from src/design/icon.ts (seed B, COLORS).
// Rasterised with the Playwright Chromium already in devDependencies; the
// .ico packs the 16 and 32 px PNGs. Runs on Node's native type stripping.
// Usage: node tools/icons.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { ICON_FILES, iconSvg } from "../src/design/icon.ts";

const publicDir = fileURLToPath(new URL("../public/", import.meta.url));

async function render(page, size, rounded) {
  await page.setViewportSize({ width: size, height: size });
  const svg = iconSvg({ rounded }).replace(
    "<svg ",
    `<svg width="${size}" height="${size}" `,
  );
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`,
  );
  return page.screenshot({
    omitBackground: true,
    clip: { x: 0, y: 0, width: size, height: size },
  });
}

// ICONDIR + one ICONDIRENTRY per image, PNG payloads (Vista and later).
function ico(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, i) => {
    const entry = 6 + i * 16;
    header[entry] = size >= 256 ? 0 : size;
    header[entry + 1] = size >= 256 ? 0 : size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.png)]);
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const favicon = [];
  for (const size of ICON_FILES.favicon.sizes)
    favicon.push({ size, png: await render(page, size, true) });
  writeFileSync(`${publicDir}${ICON_FILES.favicon.path}`, ico(favicon));
  writeFileSync(
    `${publicDir}${ICON_FILES.icon.path}`,
    await render(page, ICON_FILES.icon.sizes[0], true),
  );
  writeFileSync(
    `${publicDir}${ICON_FILES.apple.path}`,
    await render(page, ICON_FILES.apple.sizes[0], false),
  );
  console.log(`icons: wrote ${Object.values(ICON_FILES).map((f) => f.path).join(", ")}`);
} finally {
  await browser.close();
}

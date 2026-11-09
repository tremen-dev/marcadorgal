// SPEC-050 CA-3, SPEC-064 CA-4: writes public/og.png (1200 × 630) from
// src/design/social.ts (ogHtml, COLORS) and the self-hosted Geist faces.
// Usage: node tools/og-image.mjs (npm run og:image)
import { writeFileSync } from "node:fs";
import { OG_ASSET, ogHtml } from "../src/design/social.ts";
import { fontCss, renderPng, root, withPage } from "./social-render.mjs";

const png = await withPage((page) =>
  renderPng(page, ogHtml(fontCss()), OG_ASSET.width, OG_ASSET.height),
);
writeFileSync(`${root}${OG_ASSET.path}`, png);
console.log(`og: wrote ${OG_ASSET.path} (${png.length} bytes)`);

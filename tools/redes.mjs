// SPEC-064 CA-2: writes every piece of SOCIAL_ASSETS but og.png
// (tools/og-image.mjs) into assets/redes/, from src/design/social.ts (COLORS,
// iconSvg, the wordmark with its drawn block) and the self-hosted Geist faces.
// With --contacto it also writes the contact sheet _qa/SPEC-064/contacto.png:
// every piece, both variants side by side, the circular crop laid over.
// Usage: node tools/redes.mjs [--contacto] (npm run redes)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { OG_ASSET, SOCIAL_ASSETS, socialHtml } from "../src/design/social.ts";
import { COLORS, FAMILIES } from "../src/design/tokens.ts";
import { fontCss, renderPng, root, withPage } from "./social-render.mjs";

const faces = fontCss();
const pieces = SOCIAL_ASSETS.filter((a) => a !== OG_ASSET);

await withPage(async (page) => {
  for (const asset of pieces) {
    const png = await renderPng(
      page,
      socialHtml(asset, faces),
      asset.width,
      asset.height,
    );
    mkdirSync(dirname(`${root}${asset.path}`), { recursive: true });
    writeFileSync(`${root}${asset.path}`, png);
    console.log(`redes: wrote ${asset.path} (${png.length} bytes)`);
  }
  if (process.argv.includes("--contacto")) await contactSheet(page);
});

// The sheet the owner picks the variants from. Each piece at a common height;
// over the circular ones, the platform's crop (the inscribed circle, outside
// dimmed) and, dashed, the 0.40 safe circle the tests hold the art to; over
// the rectangular ones, the dashed safe zone.
async function contactSheet(page) {
  const H = 300;
  let id = 0;
  const card = (asset) => {
    const scale = H / asset.height;
    const w = Math.round(asset.width * scale);
    const data = readFileSync(`${root}${asset.path}`).toString("base64");
    const dashed = `fill="none" stroke="${COLORS.amber.value}" stroke-width="1.5" stroke-dasharray="6 5"`;
    let overlay = "";
    if (asset.safe.kind === "circle") {
      const cx = (asset.width / 2) * scale;
      const cy = (asset.height / 2) * scale;
      const crop = (asset.width / 2) * scale;
      const mask = `m${id++}`;
      overlay =
        `<defs><mask id="${mask}"><rect width="${w}" height="${H}" fill="white"/><circle cx="${cx}" cy="${cy}" r="${crop}" fill="black"/></mask></defs>` +
        `<rect width="${w}" height="${H}" fill="${COLORS.bgStep.value}" fill-opacity="0.85" mask="url(#${mask})"/>` +
        `<circle cx="${cx}" cy="${cy}" r="${crop}" fill="none" stroke="${COLORS.fgMuted.value}" stroke-width="1.5"/>` +
        `<circle cx="${cx}" cy="${cy}" r="${asset.safe.r * scale}" ${dashed}/>`;
    } else {
      const { x0, y0, x1, y1 } = asset.safe;
      overlay = `<rect x="${x0 * scale}" y="${y0 * scale}" width="${(x1 - x0) * scale}" height="${(y1 - y0) * scale}" ${dashed}/>`;
    }
    return `<figure><div class="art" style="width:${w}px;height:${H}px"><img src="data:image/png;base64,${data}" width="${w}" height="${H}"><svg width="${w}" height="${H}" viewBox="0 0 ${w} ${H}">${overlay}</svg></div><figcaption>${asset.path} · ${asset.width}×${asset.height}</figcaption></figure>`;
  };
  // Both variants of a piece in one row, side by side.
  const groups = new Map();
  for (const asset of SOCIAL_ASSETS) {
    const key = asset.path.replace(/-(oscuro|celeste)\.png$/, "");
    groups.set(key, [...(groups.get(key) ?? []), asset]);
  }
  const rows = [...groups.values()]
    .map((g) => `<section>${g.map(card).join("")}</section>`)
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    ${faces}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${COLORS.bgElevated.value}; color: ${COLORS.fgMuted.value}; font-family: ${FAMILIES.mono}; font-size: 14px; padding: 32px; width: 2000px; }
    h1 { font-family: ${FAMILIES.sans}; font-weight: 800; font-size: 28px; color: ${COLORS.fg.value}; margin-bottom: 8px; }
    p { margin-bottom: 24px; }
    section { display: flex; flex-wrap: wrap; gap: 24px; margin-bottom: 28px; }
    figure { display: flex; flex-direction: column; gap: 8px; }
    .art { position: relative; outline: 1px solid ${COLORS.lineStrong.value}; }
    .art img, .art svg { position: absolute; inset: 0; display: block; }
  </style></head><body><h1>SPEC-064 · pezas de redes</h1><p>Círculo continuo: recorte da plataforma. Trazo ámbar: zona segura (0.40 × lado nos círculos). Oscuro e celeste, lado a lado.</p>${rows}</body></html>`;
  await page.setViewportSize({ width: 2000, height: 800 });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const out = `${root}_qa/SPEC-064/contacto.png`;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, await page.screenshot({ type: "png", fullPage: true }));
  console.log("redes: wrote _qa/SPEC-064/contacto.png");
}

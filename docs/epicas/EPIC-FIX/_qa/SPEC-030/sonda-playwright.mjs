import { chromium } from "/Users/albertofojo/src/marcadorgal/node_modules/playwright/index.mjs";
const url = process.argv[2] ?? "https://marcador.gal/";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await page.route("**/api/board**", (r) => r.abort()); // only the first paint
const t0 = new Date().toISOString();
const res = await page.goto(url, { waitUntil: "domcontentloaded" });
const h = res.headers(); const rq = await res.request().allHeaders();
const html = await res.text();
const fresh = (html.match(/Actualizado [^<"]*/) || [""])[0];
const vs = [...html.matchAll(/data-version="(\d+)"/g)].map((m) => +m[1]);
console.log(`playwright | at=${t0} | status=${res.status()} | age=${h.age} | x-vercel-cache=${h["x-vercel-cache"]} | enc=${h["content-encoding"]} | etag=${h.etag} | fresh="${fresh}" | maxVersion=${vs.length?Math.max(...vs):"-"} | live=${(html.match(/data-status="live"/g)||[]).length}`);
console.log("  request headers:", JSON.stringify(rq));
await browser.close();

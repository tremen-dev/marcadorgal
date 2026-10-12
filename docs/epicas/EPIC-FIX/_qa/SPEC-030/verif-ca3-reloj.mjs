import { chromium } from "playwright";
const browser = await chromium.launch();
for (const [label, ahead] of [["fresh", 0], ["browser clock +60 s", 60_000]]) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  if (ahead) await page.clock.install({ time: Date.now() + ahead });
  const reqs = [];
  page.on("request", (r) => { if (r.url().includes("/api/board")) reqs.push({ t: Date.now(), h: r.headers()["if-none-match"] ?? null }); });
  const t0 = Date.now();
  await page.goto("http://localhost:3300/", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  console.log(`${label}: /api/board requests within ${Date.now() - t0} ms of load: ${reqs.length}`, JSON.stringify(reqs.map(r => ({ ms: r.t - t0, ifNoneMatch: r.h }))));
  await ctx.close();
}
await browser.close();

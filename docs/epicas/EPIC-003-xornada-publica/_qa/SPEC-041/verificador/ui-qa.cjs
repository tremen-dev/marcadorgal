const { chromium } = require("@playwright/test");
const fs = require("fs");
const OUT = "/out";
const LIVE = "primera-rfef-g1-2026-27-j6-bilbao-athletic-ud-ourense";
const FIN = "segunda-division-2026-27-j9-real-oviedo-real-sporting";
const res = [];
(async () => {
  const b = await chromium.launch();
  for (const [mark, port] of [["box", 3100], ["label", 3101]])
  for (const path of ["/demo/xornada", "/es/demo/xornada"])
  for (const scheme of ["light", "dark"])
  for (const width of [360, 390, 1024, 1440, 1920]) {
    const ctx = await b.newContext({ viewport: { width, height: 900 }, colorScheme: scheme });
    const p = await ctx.newPage();
    const errs = []; p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type()==="error") errs.push(m.text()); });
    await p.goto(`http://localhost:${port}${path}`);
    await p.evaluate(() => document.fonts.ready);
    const info = await p.evaluate(([LIVE, FIN]) => {
      const rows = [...document.querySelectorAll('[data-testid="match-row"]')];
      const trunc = [...document.querySelectorAll('[data-testid="team-name"]')].filter(e => e.scrollWidth > e.clientWidth + 1 || getComputedStyle(e).textOverflow === "ellipsis").map(e => e.textContent);
      const marked = [...document.querySelectorAll("[data-recent-goal]")].map(e => {
        const cs = getComputedStyle(e); const li = e.closest("li").getBoundingClientRect(); const r = e.getBoundingClientRect();
        return { id: e.closest("li").dataset.matchId, text: e.textContent, anim: cs.animationName, dur: cs.animationDuration, iter: cs.animationIterationCount, bg: cs.backgroundColor, shadow: cs.boxShadow, radius: cs.borderRadius, color: cs.color, inside: r.left >= li.left - .5 && r.right <= li.right + .5 && r.top >= li.top - .5 && r.bottom <= li.bottom + .5, sr: e.nextElementSibling?.textContent };
      });
      const tags = [...document.querySelectorAll('[data-testid="recent-goal-tag"]')].map(e => { const cs = getComputedStyle(e); const li = e.closest("li").getBoundingClientRect(); const r = e.getBoundingClientRect(); return { text: e.textContent, vis: e.innerText, ff: cs.fontFamily, fw: cs.fontWeight, fs: cs.fontSize, tt: cs.textTransform, border: cs.borderTopWidth + " " + cs.borderTopStyle + " " + cs.borderTopColor, radius: cs.borderRadius, bg: cs.backgroundColor, color: cs.color, inside: r.left >= li.left - .5 && r.right <= li.right + .5 && r.top >= li.top - .5 && r.bottom <= li.bottom + .5, w: r.width }; });
      const h = id => document.querySelector(`[data-match-id="${id}"]`)?.getBoundingClientRect().height;
      // heights of all live rows to compare marked vs unmarked of same kind
      const heights = rows.map(r => ({ id: r.dataset.matchId, h: Math.round(r.getBoundingClientRect().height * 10) / 10, marked: !!r.querySelector("[data-recent-goal]") }));
      return { trunc, marked, tags, hscroll: document.documentElement.scrollWidth > innerWidth, heights };
    }, [LIVE, FIN]);
    res.push({ mark, path, scheme, width, errs, ...info });
    if (width === 390 || width === 1440 || width === 360) {
      const tag = `${mark}-${path.startsWith("/es") ? "es" : "gl"}-${scheme}-${width}`;
      await p.locator(`[data-match-id="${LIVE}"]`).screenshot({ path: `${OUT}/${tag}-live.png` });
      await p.locator(`[data-match-id="${FIN}"]`).screenshot({ path: `${OUT}/${tag}-fin.png` });
    }
    await ctx.close();
  }
  // forced-colors / high contrast check for box: is the mark still visible without colour?
  const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, forcedColors: "active" });
  const p = await ctx.newPage(); await p.goto("http://localhost:3100/demo/xornada");
  await p.locator(`[data-match-id="${LIVE}"]`).screenshot({ path: `${OUT}/box-gl-forced-colors-live.png` });
  await ctx.close();
  fs.writeFileSync(`${OUT}/qa.json`, JSON.stringify(res, null, 1));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });

// Records /demo/xornada as a 1080x1920 reel, deterministically: a timeline of
// events, and per frame (30 fps) every CSS animation is paused and set to its
// exact time, scroll is set by hand, then a full-res screenshot is taken.
import { createRequire } from "node:module";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(new URL("../../../package.json", import.meta.url));
const { chromium } = require("playwright");

const OUT = process.argv[2];
const FPS = 30;
const FRAMES = join(OUT, "frames");
rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 360, height: 640 },
  deviceScaleFactor: 3,
  colorScheme: "dark",
  hasTouch: true,
  isMobile: true,
});
// No hot reload: another session may be editing the repo.
let muteHmr = false;
await page.routeWebSocket(/hmr|turbopack|_next/, (ws) => {
  const server = ws.connectToServer();
  server.onMessage((m) => { if (!muteHmr) ws.send(m); });
  ws.onMessage((m) => server.send(m));
});
let reloaded = false;
await page.goto("http://localhost:3011/demo/xornada", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
muteHmr = true; // hydrated: from here on, no hot reload can reach the page
if (!(await page.evaluate(() => Object.keys(document.querySelector('[data-testid="match-row"]')).some((k) => k.startsWith("__react")))))
  throw new Error("page not hydrated");
page.on("framenavigated", (f) => { if (f === page.mainFrame()) reloaded = true; });

await page.addStyleTag({
  content: `
  nextjs-portal { display: none !important; }
  #reel-chip { position: fixed; top: 66px; right: 12px; z-index: 9999;
    font-family: inherit; font-size: 11px; font-weight: 600; letter-spacing: .06em;
    text-transform: uppercase; color: #111110; background: #fbbf24;
    padding: 4px 8px; border-radius: 6px; }
  #reel-cap { position: fixed; left: 50%; top: 330px; z-index: 9999;
    transform: translate(-50%, 12px); opacity: 0; transition: opacity .35s, transform .35s;
    font-family: inherit; font-size: 22px; font-weight: 700; line-height: 1.2;
    text-align: center; color: #111110; background: #009BCF;
    padding: 12px 18px; border-radius: 14px; width: max-content; max-width: 320px;
    box-shadow: 0 10px 30px rgba(0,0,0,.5); }
  #reel-cap.on { opacity: 1; transform: translate(-50%, 0); }
  .reel-tap { position: fixed; z-index: 9998; width: 44px; height: 44px; margin: -22px 0 0 -22px;
    border-radius: 50%; background: rgba(255,255,255,.35); border: 2px solid rgba(255,255,255,.8);
    pointer-events: none; animation: reelTap .6s ease-out forwards; }
  @keyframes reelTap { from { transform: scale(.4); opacity: 1 } to { transform: scale(1.4); opacity: 0 } }
  `,
});

// Page-side helpers.
await page.evaluate(() => {
  const chip = document.createElement("div");
  chip.id = "reel-chip";
  chip.textContent = "Exemplo · datos de mostra";
  document.body.append(chip);
  const cap = document.createElement("div");
  cap.id = "reel-cap";
  document.body.append(cap);

  const R = (window.__reel = {});
  R.seen = new Map();
  R.row = (t) => [...document.querySelectorAll('[data-testid="match-row"]')].find((r) => r.textContent.includes(t));
  R.setTime = (t) => {
    for (const a of document.getAnimations()) {
      if (!R.seen.has(a)) R.seen.set(a, t);
      a.pause();
      a.currentTime = Math.max(0, t - R.seen.get(a));
    }
  };
  R.capOff = () => document.getElementById("reel-cap").classList.remove("on");
  R.capOn = (html) => { const c = document.getElementById("reel-cap"); c.innerHTML = html; c.classList.add("on"); };
  R.top = (sel, t) => [...document.querySelectorAll(sel)].find((e) => e.textContent.includes(t)).getBoundingClientRect().top + scrollY;
  R.maxScroll = () => document.documentElement.scrollHeight - innerHeight;
  R.tap = (t) => {
    const row = R.row(t), b = row.getBoundingClientRect();
    const d = document.createElement("div");
    d.className = "reel-tap";
    d.style.left = b.left + b.width * 0.55 + "px";
    d.style.top = b.top + Math.min(b.height / 2, 30) + "px";
    document.body.append(d);
    row.click();
  };
  // Betis–Deportivo, live at 78' and 2-1.
  R.deporLive = () => {
    const row = R.row("Deportivo"), celta = R.row("Celta");
    row.className = celta.className;
    row.dataset.status = "live";
    const m = celta.querySelector('[data-testid="match-margin-lines"]').cloneNode(true);
    m.querySelector('[data-testid="match-margin"]').lastChild.textContent = "78'";
    m.querySelector('[data-testid="match-margin-sub"] [aria-hidden]').textContent = "2ª P";
    row.querySelector('[data-testid="match-margin-lines"]').replaceWith(m);
    row.querySelectorAll('[class*="winner"],[class*="loser"]').forEach((e) => {
      e.className = e.className.replace(/\S*(winner|loser)\S*/g, "").trim();
    });
  };
  // Miguel Loureiro equalises: 2-2, pulsing score, GOL tag, scorer line.
  R.deporGoal = () => {
    const row = R.row("Deportivo"), ref = R.row("Sporting");
    const team = row.querySelectorAll('[data-testid="team-name"]')[1];
    const score = row.querySelectorAll('[data-testid="score"]')[1];
    score.textContent = "2";
    score.className = ref.querySelector("[data-recent-goal]").className;
    score.style.animationIterationCount = "240";
    team.after(ref.querySelector('[data-testid="recent-goal-tag"]').cloneNode(true));
    const list = row.querySelector('[data-testid="team-goals"][data-team="away"] [class*="list"]');
    const line = ref.querySelector('[data-testid="goal-line"]').cloneNode(true);
    line.querySelector('[data-testid="goal-minute"]').textContent = "78'";
    line.querySelector('[data-testid="goal-player"]').textContent = "Miguel Loureiro";
    list.prepend(line);
  };
  R.deporLive();
  scrollTo(0, 0);
});

// Timeline (seconds). Captions swap with a 0.25 s gap; scrolls are eased.
const ev = [];
const at = (t, fn) => ev.push({ t, fn });
const caption = (t, html) => {
  at(t, () => page.evaluate(() => __reel.capOff()));
  if (html) at(t + (t > 0.2 ? 0.25 : 0), () => page.evaluate((h) => __reel.capOn(h), html));
};
const scrolls = [];
const scroll = (t, dur, target) =>
  at(t, async () => {
    const from = await page.evaluate(() => scrollY);
    const to = Math.max(0, Math.min(await page.evaluate(target), await page.evaluate(() => __reel.maxScroll())));
    scrolls.push({ t, dur, from, to });
  });
const tap = (t, team) => at(t, () => page.evaluate((x) => __reel.tap(x), team));

caption(0.2, "Todo o fútbol galego<br>nunha pantalla");
at(2.6, () => page.evaluate(() => __reel.deporGoal()));
caption(2.6, "GOL! ⚽<br>ao momento");
caption(4.9, null);
scroll(5.0, 0.5, () => __reel.top('[data-testid="match-row"]', "Deportivo") - 95);
tap(5.7, "Deportivo");
caption(5.9, "E quen os marca");
caption(8.4, "De Primeira…");
scroll(8.6, 1.1, () => __reel.top("section", "Segunda División") - 70);
tap(10.0, "Sporting");
caption(11.6, "…a Terceira RFEF");
scroll(11.8, 2.6, () => __reel.top("section", "Terceira Federación") - 70);
caption(15.4, "En directo e en galego");
const END = 17.6;

const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
ev.sort((a, b) => a.t - b.t);
const total = Math.round(END * FPS);
let next = 0;
for (let i = 0; i < total; i++) {
  const t = i / FPS;
  while (next < ev.length && ev[next].t <= t + 1e-9) await ev[next++].fn();
  const s = scrolls.findLast((s) => t >= s.t);
  const y = s ? s.from + (s.to - s.from) * ease(Math.min(1, (t - s.t) / s.dur)) : 0;
  await page.evaluate(([ms, y]) => { scrollTo(0, y); __reel.setTime(ms); }, [t * 1000, y]);
  if (reloaded) throw new Error(`page reloaded at frame ${i}`);
  writeFileSync(join(FRAMES, `f${String(i).padStart(5, "0")}.jpg`), await page.screenshot({ type: "jpeg", quality: 92 }));
}
console.log(`frames=${total} seconds=${END}`);
await browser.close();

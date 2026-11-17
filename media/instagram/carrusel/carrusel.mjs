// Instagram carousel "Resumo da xornada" from the public marcador.gal page.
// Usage (from the repo root): node media/instagram/carrusel/carrusel.mjs <outDir> [url] [--goleadores]
// url defaults to https://marcador.gal/ (current xornada); archive: https://marcador.gal/xornada/YYYY-MM-DD
// Only matches with a Galician side; Galician names in brand colour; scorers
// of the Galician sides. Slides 1080x1350 (4:5), PNG.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fontCss, withPage } from "../../../tools/social-render.mjs";
import { COLORS, FAMILIES } from "../../../src/design/tokens.ts";

const OUT = process.argv[2];
const URL = process.argv[3] ?? "https://marcador.gal/";
const W = 1080, H = 1350, PER_SLIDE = 6;
const C = Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [k, v.value]));
const MONTHS = ["xaneiro", "febreiro", "marzo", "abril", "maio", "xuño", "xullo", "agosto", "setembro", "outubro", "novembro", "decembro"];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const scrape = (page) =>
  page.evaluate(() => {
    const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
    return [...document.querySelectorAll("section")].filter((s) => s.querySelector("h2")).map((s) => ({
      competition: txt(s.querySelector("h2")),
      round: ([...s.querySelectorAll("*")].map((e) => txt(e)).find((t) => /^xornada \d+$/i.test(t)) || "").replace(/\D/g, "") || null,
      matches: [...s.querySelectorAll('[data-testid="match-row"]')].map((row) => {
        const names = [...row.querySelectorAll('[data-testid="team-name"]')];
        const scores = [...row.querySelectorAll('[data-testid="score"]')].map(txt);
        const side = (team) => {
          const block = row.querySelector(`[data-testid="team-goals"][data-team="${team}"]`);
          return block ? [...block.querySelectorAll('[data-testid="goal-line"]')].map((l) => ({
            minute: txt(l.querySelector('[data-testid="goal-minute"]')),
            player: txt(l.querySelector('[data-testid="goal-player"]')),
            note: /\(p\.\)/.test(l.textContent) && !/p\.p\./.test(l.textContent) ? "p." : /p\.p\./.test(l.textContent) ? "p.p." : "",
          })) : [];
        };
        return {
          status: row.dataset.status,
          day: row.dataset.day,
          margin: txt(row.querySelector('[data-testid="match-margin"]')),
          marginSub: txt(row.querySelector('[data-testid="match-margin-sub"] [aria-hidden]') || row.querySelector('[data-testid="match-margin-sub"]')),
          home: { name: txt(names[0]), galician: names[0]?.dataset.galician === "true", score: scores[0], goals: side("home") },
          away: { name: txt(names[1]), galician: names[1]?.dataset.galician === "true", score: scores[1], goals: side("away") },
        };
      }),
    }));
  });

function dateRange(days) {
  const ds = [...new Set(days.filter(Boolean))].sort();
  if (!ds.length) return "";
  const p = (d) => { const [, m, dd] = d.split("-").map(Number); return { m, d: dd }; };
  const a = p(ds[0]), b = p(ds.at(-1));
  if (ds.length === 1) return `${a.d} de ${MONTHS[a.m - 1]}`;
  return a.m === b.m ? `${a.d}–${b.d} de ${MONTHS[b.m - 1]}` : `${a.d} de ${MONTHS[a.m - 1]} – ${b.d} de ${MONTHS[b.m - 1]}`;
}

const base = (faces, body, extraCss = "") => `<!doctype html><html><head><meta charset="utf-8"><style>
  ${faces}
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${W}px; height: ${H}px; background: ${C.bg}; color: ${C.fg}; overflow: hidden; }
  body { font-family: ${FAMILIES.sans}; font-variant-numeric: tabular-nums; }
  .wordmark { font-family: ${FAMILIES.sans}; font-weight: 800; letter-spacing: -0.045em; line-height: 1; white-space: nowrap; color: ${C.fg}; }
  .block { display: inline-block; width: .3em; height: .72em; margin: 0 .06em; border-radius: .095em; background: ${C.brand}; vertical-align: baseline; }
  .mono { font-family: ${FAMILIES.mono}; }
  .frame { position: absolute; inset: 0; padding: 72px 72px 64px; display: flex; flex-direction: column; }
  .top { display: flex; justify-content: space-between; align-items: center; }
  .top .wordmark { font-size: 34px; }
  .top .when { font-family: ${FAMILIES.mono}; font-size: 22px; font-weight: 500; letter-spacing: .08em; text-transform: uppercase; color: ${C.fgMuted}; }
  .foot { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 24px;
    font-family: ${FAMILIES.mono}; font-size: 22px; font-weight: 500; color: ${C.fgDim}; letter-spacing: .02em; }
  ${extraCss}
</style></head><body>${body}</body></html>`;

function coverHtml(faces, { range, teams, comps }) {
  return base(faces, `<div class="frame">
    <div class="top"><div class="wordmark">${"marcador<span class=block></span>gal"}</div></div>
    <div class="hero">
      <div class="kicker">Resumo da xornada</div>
      <div class="range">${esc(range)}</div>
      <div class="bar"></div>
      <div class="sub">${teams} equipos galegos<br>en ${comps.length} competicións</div>
      <div class="pills">${comps.map((c) => `<span class="pill">${esc(c)}</span>`).join("")}</div>
    </div>
    <div class="foot"><span>marcador.gal</span><span class="swipe">Desliza →</span></div>
  </div>`, `
  .hero { margin-top: 160px; }
  .kicker { font-family: ${FAMILIES.mono}; font-size: 30px; font-weight: 500; letter-spacing: .1em; text-transform: uppercase; color: ${C.brand}; }
  .range { font-size: 112px; font-weight: 800; line-height: 1.02; letter-spacing: -0.03em; margin-top: 28px; }
  .bar { width: 120px; height: 14px; border-radius: 7px; background: ${C.brand}; margin: 56px 0 48px; }
  .sub { font-size: 44px; font-weight: 500; line-height: 1.3; color: ${C.fgMuted}; }
  .swipe { color: ${C.fg}; }
  .pills { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 64px; }
  .pill { font-family: ${FAMILIES.mono}; font-size: 24px; font-weight: 500; color: ${C.fg}; border: 2px solid ${C.line}; background: ${C.bgStep}; padding: 10px 18px; border-radius: 10px; }`);
}

function scorers(side) {
  if (!side.galician || !side.goals.length) return "";
  return side.goals
    .slice().sort((a, b) => parseInt(a.minute) - parseInt(b.minute))
    .map((g) => `<span class="g"><span class="min">${esc(g.minute)}</span> ${esc(g.player)}${g.note ? ` <span class="note">(${g.note})</span>` : ""}</span>`)
    .join("");
}

function statusLabel(m) {
  if (m.status === "finished") return "";
  if (m.status === "postponed") return "Aprazado";
  if (m.status === "suspended") return "Suspendido";
  if (m.status === "live") return "En xogo";
  return [m.marginSub, m.margin].filter(Boolean).join(" · ");
}

const SHOW_SCORERS = process.argv.includes("--goleadores");

function matchHtml(m) {
  const finished = m.status === "finished";
  const h = Number(m.home.score), a = Number(m.away.score);
  const cls = (side, me, other) => [side.galician ? "gal" : "", finished && me < other ? "loser" : ""].join(" ");
  const lbl = statusLabel(m);
  const sc = SHOW_SCORERS ? [scorers(m.home), scorers(m.away)].filter(Boolean).join("") : "";
  return `<div class="match">
      <div class="line"><span class="team ${cls(m.home, h, a)}">${esc(m.home.name)}</span><span class="score ${finished && h < a ? "loser" : ""}">${esc(m.home.score || "–")}</span></div>
      <div class="line"><span class="team ${cls(m.away, a, h)}">${esc(m.away.name)}</span><span class="score ${finished && a < h ? "loser" : ""}">${esc(m.away.score || "–")}</span></div>
      ${lbl ? `<div class="status">${esc(lbl)}</div>` : ""}
      ${sc ? `<div class="scorers">${sc}</div>` : ""}
    </div>`;
}

function compHtml(faces, { groups, range, index, total }) {
  const body = groups.map((g) => `<div class="group">
      <div class="head">
        <div class="comp">${esc(g.competition)}</div>
        <div class="round">${g.round ? `Xornada ${esc(g.round)}` : ""}${g.part ? ` · ${g.part}` : ""}</div>
      </div>
      <div class="list">${g.matches.map(matchHtml).join("")}</div>
    </div>`).join("");
  return base(faces, `<div class="frame">
    <div class="top"><div class="wordmark">marcador<span class=block></span>gal</div><div class="when">${esc(range)}</div></div>
    <div class="rows" id="rows">${body}</div>
    <div class="foot"><span>${index}/${total}</span><span>marcador.gal</span></div>
  </div>`, `
  :root { --s: 1; }
  .rows { margin-top: 56px; }
  .group + .group { margin-top: calc(56px * var(--s)); }
  .head { margin-bottom: calc(28px * var(--s)); padding-left: 28px; border-left: 12px solid ${C.brand}; }
  .comp { font-size: 58px; font-weight: 800; line-height: 1.05; letter-spacing: -0.02em; }
  .round { font-family: ${FAMILIES.mono}; font-size: 26px; font-weight: 500; letter-spacing: .06em; text-transform: uppercase; color: ${C.fgMuted}; margin-top: 14px; }
  .rows { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
  .match { padding: calc(22px * var(--s)) 0; border-top: 2px solid ${C.line}; }
  .list .match:last-child { border-bottom: 2px solid ${C.line}; }
  .line { display: flex; justify-content: space-between; align-items: baseline; gap: 24px; }
  .team { font-size: calc(42px * var(--s)); font-weight: 500; line-height: 1.22; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .team.gal { color: ${C.brand}; font-weight: 700; }
  .score { font-family: ${FAMILIES.mono}; font-size: calc(46px * var(--s)); font-weight: 700; line-height: 1.15; }
  .loser { color: ${C.fgMuted}; }
  .team.gal.loser { color: ${C.brand}; opacity: .75; }
  .status { font-family: ${FAMILIES.mono}; font-size: calc(24px * var(--s)); font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: ${C.amber}; margin-top: calc(8px * var(--s)); }
  .scorers { display: flex; flex-wrap: wrap; column-gap: 28px; row-gap: 4px; margin-top: calc(10px * var(--s));
    font-size: calc(26px * var(--s)); font-weight: 500; line-height: 1.3; color: ${C.fgMuted}; }
  .scorers .min { font-family: ${FAMILIES.mono}; color: ${C.fgDim}; }
  .scorers .note { color: ${C.fgDim}; }`);
}

function closeHtml(faces) {
  return base(faces, `<div class="frame">
    <div class="center">
      <div class="wordmark big">marcador<span class=block></span>gal</div>
      <div class="claim">Todo o fútbol galego<br>nunha pantalla</div>
      <div class="cta">Resultados en directo, goles e goleadores<br>de Primeira a Terceira RFEF</div>
      <div class="link">Ligazón na bio</div>
    </div>
  </div>`, `
  .center { margin: auto 0; display: flex; flex-direction: column; align-items: center; text-align: center; }
  .big { font-size: 108px; }
  .claim { font-size: 60px; font-weight: 700; line-height: 1.15; margin-top: 72px; letter-spacing: -0.015em; }
  .cta { font-size: 34px; font-weight: 500; line-height: 1.4; color: ${C.fgMuted}; margin-top: 40px; }
  .link { margin-top: 72px; font-family: ${FAMILIES.mono}; font-size: 30px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase;
    color: ${C.bg}; background: ${C.brand}; padding: 18px 32px; border-radius: 14px; }`);
}

const faces = fontCss();
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

await withPage(async (page) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(URL, { waitUntil: "networkidle" });
  const sections = (await scrape(page))
    .map((s) => ({ ...s, matches: s.matches.filter((m) => m.home.galician || m.away.galician) }))
    .filter((s) => s.matches.length);
  const all = sections.flatMap((s) => s.matches);
  const range = dateRange(all.map((m) => m.day));
  const teams = new Set(all.flatMap((m) => [m.home, m.away].filter((t) => t.galician).map((t) => t.name))).size;

  const chunks = sections.flatMap((s) => {
    const n = Math.ceil(s.matches.length / PER_SLIDE);
    const per = Math.ceil(s.matches.length / n);
    return Array.from({ length: n }, (_, i) => ({ ...s, matches: s.matches.slice(i * per, (i + 1) * per), part: n > 1 ? `${i + 1}/${n}` : "" }));
  });
  // Small competitions share a slide (at most MERGE matches together).
  const MERGE = 5;
  const compSlides = [];
  for (const c of chunks) {
    const last = compSlides.at(-1);
    const size = (sl) => sl.groups.reduce((n, g) => n + g.matches.length, 0);
    if (last && !c.part && !last.groups.at(-1).part && size(last) + c.matches.length <= MERGE) last.groups.push(c);
    else compSlides.push({ groups: [c] });
  }
  const total = compSlides.length + 2;
  const htmls = [
    coverHtml(faces, { range, teams, comps: sections.map((s) => s.competition.replace(/ · Grupo \d+/, "")) }),
    ...compSlides.map((s, i) => compHtml(faces, { ...s, range, index: i + 2, total })),
    closeHtml(faces),
  ];

  await page.setViewportSize({ width: W, height: H });
  for (const [i, html] of htmls.entries()) {
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    // Shrink rows until they fit.
    await page.evaluate(() => {
      const rows = document.getElementById("rows");
      if (!rows) return;
      let s = 1.7;
      document.documentElement.style.setProperty("--s", s);
      while (rows.scrollHeight > rows.clientHeight + 1 && s > 0.6) {
        s -= 0.02;
        document.documentElement.style.setProperty("--s", s);
      }
    });
    const file = join(OUT, `${String(i + 1).padStart(2, "0")}.png`);
    writeFileSync(file, await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: H } }));
  }
  writeFileSync(join(OUT, "datos.json"), JSON.stringify({ url: URL, range, sections }, null, 2));
  console.log(`slides=${htmls.length} range="${range}" teams=${teams} comps=${sections.map((s) => `${s.competition}(${s.matches.length})`).join(", ")}`);
});

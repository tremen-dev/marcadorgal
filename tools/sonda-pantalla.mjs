#!/usr/bin/env node
// The screen probe of SPEC-025 CA-3 (H-2). It opens the public screen, / and
// /es, at 390 px in a fresh context with no storage (Chromium of
// @playwright/test: no new dependency), and writes one JSON line per event:
//
//   pintura      every change of a [data-match-id] row (MutationObserver, then
//                requestAnimationFrame): matchId, version, marcador, estado and
//                paintedAt, the probe's clock, ISO with Z. The rows on screen
//                when the page loads come with inicial: true.
//   respuesta    every response of /api/board: status (200/304), Age,
//                x-vercel-cache, Date and the local instant it arrived.
//   visibilidad  once a minute, document.visibilityState (must be "visible").
//   inicio, fin, error   the probe's own life.
//
// It only reads the public screen: no secret, no cookie of its own, nothing
// written anywhere but its JSONL. src/medicion/sonda.ts parses it.
//
// Usage: node tools/sonda-pantalla.mjs [--horas 5.5] [--url https://marcador.gal]
//          [--rutas /,/es] [--salida <fichero.jsonl>]
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const MAX_HORAS = 5.5; // a GitHub Actions job lasts at most 6 h (H-2)
const ANCHO = 390;
const ALTO = 844;
const MINUTO = 60_000;
const QA_DIR = "docs/epicas/EPIC-003-xornada-publica/_qa/SPEC-025";

const USAGE =
  "Uso: node tools/sonda-pantalla.mjs [--horas <≤ 5.5>] [--url <base>] [--rutas /,/es] [--salida <fichero.jsonl>]";

function parseArgs(argv) {
  const args = {
    horas: MAX_HORAS,
    url: "https://marcador.gal",
    rutas: ["/", "/es"],
    salida: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!["--horas", "--url", "--rutas", "--salida"].includes(flag))
      throw new Error(`opción desconocida: ${flag}`);
    if (value === undefined || value.startsWith("--"))
      throw new Error(`${flag} necesita un valor`);
    i += 1;
    if (flag === "--horas") {
      const horas = Number(value);
      if (!Number.isFinite(horas) || horas <= 0 || horas > MAX_HORAS)
        throw new Error(`--horas va de 0 a ${MAX_HORAS}`);
      args.horas = horas;
    } else if (flag === "--url") args.url = value.replace(/\/+$/, "");
    else if (flag === "--rutas")
      args.rutas = value.split(",").filter((r) => r.startsWith("/"));
    else args.salida = value;
  }
  if (args.rutas.length === 0) throw new Error("--rutas sin ninguna ruta");
  return args;
}

let args;
try {
  args = parseArgs(process.argv.slice(2));
} catch (e) {
  console.error(`${e instanceof Error ? e.message : String(e)}\n${USAGE}`);
  process.exit(1);
}

const ahora = () => new Date().toISOString();
const inicio = ahora();
const salida =
  args.salida ??
  path.join(QA_DIR, `sonda-${inicio.replaceAll(":", "-")}.jsonl`);
mkdirSync(path.dirname(salida), { recursive: true });
// One line at a time and synchronously: a job killed at the 6 h mark keeps
// everything written until then.
const escribe = (linea) => appendFileSync(salida, `${JSON.stringify(linea)}\n`);

// Runs in the page, before any of its scripts. From DOMContentLoaded on, every
// mutation schedules one scan in the next animation frame; the scan reports
// the rows whose version, score or status changed since the last one.
const observador = () => {
  const vistos = new Map();
  let pendiente = false;
  let inicial = true;
  const filaDe = (el) => {
    const scores = [...el.querySelectorAll('[data-testid="score"]')].map(
      (s) => s.textContent?.trim() ?? "",
    );
    const marcador =
      scores.length === 2 && scores.every((s) => /^\d+$/.test(s))
        ? `${scores[0]}-${scores[1]}`
        : null;
    return {
      matchId: el.getAttribute("data-match-id") ?? "",
      version: Number(el.getAttribute("data-version") ?? "-1"),
      marcador,
      estado: el.getAttribute("data-status") ?? "",
    };
  };
  const escanea = () => {
    pendiente = false;
    const paintedAt = new Date().toISOString();
    const esInicial = inicial;
    inicial = false;
    for (const el of document.querySelectorAll("[data-match-id]")) {
      const fila = filaDe(el);
      if (fila.matchId === "" || !Number.isInteger(fila.version)) continue;
      const firma = `${fila.version}|${fila.marcador}|${fila.estado}`;
      if (vistos.get(fila.matchId) === firma) continue;
      vistos.set(fila.matchId, firma);
      window.__sondaPintura({ ...fila, paintedAt, inicial: esInicial });
    }
  };
  const programa = () => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(escanea);
  };
  document.addEventListener("DOMContentLoaded", () => {
    programa();
    new MutationObserver(programa).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
  });
};

const browser = await chromium.launch();
const paginas = [];
let cerrando = false;

async function abre(ruta) {
  // A fresh context per route: no cookies, no storage, no cache shared.
  const context = await browser.newContext({
    viewport: { width: ANCHO, height: ALTO },
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  await page.exposeFunction("__sondaPintura", (fila) =>
    escribe({ tipo: "pintura", ruta, ...fila }),
  );
  await page.addInitScript(observador);
  page.on("response", (r) => {
    let pathname;
    try {
      pathname = new URL(r.url()).pathname;
    } catch {
      return;
    }
    if (pathname !== "/api/board") return;
    const h = r.headers();
    escribe({
      tipo: "respuesta",
      ruta,
      estado: r.status(),
      age: h.age ?? null,
      xVercelCache: h["x-vercel-cache"] ?? null,
      date: h.date ?? null,
      instante: ahora(),
    });
  });
  page.on("crash", () => {
    escribe({ tipo: "error", ruta, mensaje: "page crashed", instante: ahora() });
    if (cerrando) return;
    context.close().catch(() => {});
    abre(ruta).catch((e) =>
      escribe({ tipo: "error", ruta, mensaje: String(e), instante: ahora() }),
    );
  });
  await page.goto(`${args.url}${ruta}`, { waitUntil: "domcontentloaded" });
  const entrada = { ruta, page, context };
  const i = paginas.findIndex((p) => p.ruta === ruta);
  if (i === -1) paginas.push(entrada);
  else paginas[i] = entrada;
}

escribe({
  tipo: "inicio",
  instante: inicio,
  url: args.url,
  rutas: args.rutas,
  ancho: ANCHO,
  horas: args.horas,
});

for (const ruta of args.rutas) {
  try {
    await abre(ruta);
  } catch (e) {
    escribe({ tipo: "error", ruta, mensaje: String(e), instante: ahora() });
  }
}

const visibilidad = setInterval(async () => {
  for (const { ruta, page } of paginas) {
    try {
      const estado = await page.evaluate(() => document.visibilityState);
      escribe({ tipo: "visibilidad", ruta, estado, instante: ahora() });
    } catch (e) {
      escribe({ tipo: "error", ruta, mensaje: String(e), instante: ahora() });
    }
  }
}, MINUTO);

async function termina() {
  if (cerrando) return;
  cerrando = true;
  clearInterval(visibilidad);
  escribe({ tipo: "fin", instante: ahora() });
  await browser.close().catch(() => {});
  console.error(`sonda: escrito ${salida}`);
  process.exit(0);
}

process.on("SIGINT", termina);
process.on("SIGTERM", termina);
setTimeout(termina, args.horas * 60 * MINUTO);

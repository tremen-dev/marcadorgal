#!/usr/bin/env node
// SPEC-026: first paint on a phone over 3G. The shell and nothing more: it
// drives the Chromium of @playwright/test (no new dependency) under the CA-1
// profile, one fresh context per pass, and hands what it saw to the pure
// src/medicion/pintura.ts, which computes every number of the report.
//
// Per pass (CA-2): Navigation and Paint Timing (TTFB, FCP), LCP, bytes of the
// document and of the initial JS/CSS, x-vercel-cache and Age of the document,
// the rows of the served HTML (the body as it arrived, no JS run) and the
// instant the first [data-match-id] entered the DOM, to check that the FCP
// already has rows.
//
// It only reads the public screen: no secret, no cookie, nothing written but
// its two files.
//
// The verdict only exists for --url https://marcador.gal with / and /es,
// n 20 and a pause of 15 s (CA-3); anything else is a trial and its report
// says MUESTRA NO VÁLIDA.
//
// Usage: npm run primera:pintura -- [--n 20] [--url https://marcador.gal]
//          [--rutas /,/es] [--pausa 15] [--salida <directorio>]
//   --n       passes per route (CA-3: 20); routes alternate.
//   --pausa   seconds between passes (CA-3: ≥ 15, so CDN misses get in).
//   --salida  by default docs/epicas/EPIC-003-xornada-publica/_qa/SPEC-026
// Writes primera-pintura-<fecha>.md (one page) and .json (each pass, raw).
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import {
  filasEnHtml,
  informePintura,
  pasada,
} from "../src/medicion/pintura.ts";

// CA-1 (H-1): the «3G» profile of WebPageTest, CPU ×4. The only place it lives.
export const PERFIL_3G = Object.freeze({
  nombre: "3G (WebPageTest)",
  bajadaKbps: 1600,
  subidaKbps: 768,
  rttMs: 300,
  cpu: 4,
  ancho: 390,
  alto: 844,
  dpr: 3,
  movil: true,
});

const QA_DIR = "docs/epicas/EPIC-003-xornada-publica/_qa/SPEC-026";
const USAGE =
  "Uso: npm run primera:pintura -- [--n 20] [--url <base>] [--rutas /,/es] [--pausa 15] [--salida <directorio>]";
// After load, how long to wait for the LCP to settle.
const ESPERA_LCP_MS = 1500;
const TIMEOUT_MS = 60_000;

export function opcionesContexto(p) {
  return {
    viewport: { width: p.ancho, height: p.alto },
    deviceScaleFactor: p.dpr,
    isMobile: p.movil,
    hasTouch: p.movil,
    serviceWorkers: "block",
  };
}

// CDP wants bytes per second; the profile speaks kbit/s like WebPageTest.
export async function aplicaPerfil(cdp, p) {
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: p.rttMs,
    downloadThroughput: (p.bajadaKbps * 1000) / 8,
    uploadThroughput: (p.subidaKbps * 1000) / 8,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: p.cpu });
}

function parseArgs(argv) {
  const args = {
    n: 20,
    url: "https://marcador.gal",
    rutas: ["/", "/es"],
    pausa: 15,
    salida: QA_DIR,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!["--n", "--url", "--rutas", "--pausa", "--salida"].includes(flag))
      throw new Error(`opción desconocida: ${flag}`);
    if (value === undefined || value.startsWith("--"))
      throw new Error(`${flag} necesita un valor`);
    i += 1;
    if (flag === "--n" || flag === "--pausa") {
      const x = Number(value);
      if (!Number.isInteger(x) || x < (flag === "--n" ? 1 : 0))
        throw new Error(`${flag} tiene que ser un entero${flag === "--n" ? " ≥ 1" : " ≥ 0"}`);
      args[flag.slice(2)] = x;
    } else if (flag === "--url") args.url = value.replace(/\/+$/, "");
    else if (flag === "--rutas")
      args.rutas = value.split(",").filter((r) => r.startsWith("/"));
    else args.salida = value;
  }
  if (args.rutas.length === 0) throw new Error("--rutas sin ninguna ruta");
  return args;
}

// Runs in the page before any of its scripts: when the first row enters the
// DOM, and the largest contentful paint.
function sondaEnPagina() {
  const estado = { primeraFila: null, lcp: null };
  window.__pintura = estado;
  const mo = new MutationObserver(() => {
    if (document.querySelector("[data-match-id]")) {
      estado.primeraFila = performance.now();
      mo.disconnect();
    }
  });
  mo.observe(document, { childList: true, subtree: true });
  new PerformanceObserver((lista) => {
    for (const e of lista.getEntries()) estado.lcp = e.startTime;
  }).observe({ type: "largest-contentful-paint", buffered: true });
}

async function unaPasada(browser, url, ruta) {
  const inicio = new Date().toISOString();
  const crudo = {
    ruta,
    inicio,
    status: null,
    cabeceras: { xVercelCache: null, age: null },
    filas: { filas: 0, conDato: 0 },
    navegacion: null,
    fcpMs: null,
    lcpMs: null,
    primeraFilaMs: null,
    ttfbRedMs: null,
    finDocumentoRedMs: null,
    recursos: [],
    error: null,
  };
  const context = await browser.newContext(opcionesContexto(PERFIL_3G));
  try {
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    // The document's request and response on the emulated network: Navigation
    // Timing's responseStart does not include the latency CDP adds.
    let documento = null;
    cdp.on("Network.requestWillBeSent", (e) => {
      if (documento === null && e.type === "Document")
        documento = { id: e.requestId, enviado: e.timestamp };
    });
    cdp.on("Network.responseReceived", (e) => {
      if (documento !== null && e.requestId === documento.id)
        crudo.ttfbRedMs = (e.timestamp - documento.enviado) * 1000;
    });
    // End of the document on the same clock, so the transfer stretch of the
    // report does not mix CDP with Navigation Timing.
    cdp.on("Network.loadingFinished", (e) => {
      if (documento !== null && e.requestId === documento.id)
        crudo.finDocumentoRedMs = (e.timestamp - documento.enviado) * 1000;
    });
    await aplicaPerfil(cdp, PERFIL_3G);
    await page.addInitScript(sondaEnPagina);
    const res = await page.goto(`${url}${ruta}`, {
      waitUntil: "load",
      timeout: TIMEOUT_MS,
    });
    if (res) {
      crudo.status = res.status();
      const h = res.headers();
      crudo.cabeceras = {
        xVercelCache: h["x-vercel-cache"] ?? null,
        age: h.age ?? null,
      };
      crudo.filas = filasEnHtml(await res.text());
    }
    await page.waitForTimeout(ESPERA_LCP_MS);
    Object.assign(
      crudo,
      await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0];
        const fcp = performance
          .getEntriesByType("paint")
          .find((e) => e.name === "first-contentful-paint");
        return {
          navegacion: nav
            ? {
                responseStart: nav.responseStart,
                responseEnd: nav.responseEnd,
                transferSize: nav.transferSize,
                encodedBodySize: nav.encodedBodySize,
                domContentLoadedEventEnd: nav.domContentLoadedEventEnd,
              }
            : null,
          fcpMs: fcp ? fcp.startTime : null,
          lcpMs: window.__pintura?.lcp ?? null,
          primeraFilaMs: window.__pintura?.primeraFila ?? null,
          recursos: performance.getEntriesByType("resource").map((r) => ({
            name: r.name,
            startTime: r.startTime,
            transferSize: r.transferSize,
            encodedBodySize: r.encodedBodySize,
          })),
        };
      }),
    );
  } catch (e) {
    crudo.error = e instanceof Error ? e.message.split("\n")[0] : String(e);
  } finally {
    await context.close();
  }
  return crudo;
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`${e instanceof Error ? e.message : String(e)}\n${USAGE}`);
    process.exit(1);
  }
  const inicio = new Date().toISOString();
  const base = `primera-pintura-${inicio.slice(0, 16).replace(":", "-")}`;
  mkdirSync(args.salida, { recursive: true });
  const browser = await chromium.launch();
  const navegador = `Chromium ${browser.version()}`;
  const crudos = [];
  try {
    for (let i = 0; i < args.n; i += 1) {
      for (const ruta of args.rutas) {
        if (crudos.length > 0)
          await new Promise((r) => setTimeout(r, args.pausa * 1000));
        const c = await unaPasada(browser, args.url, ruta);
        crudos.push(c);
        const p = pasada(c);
        console.log(
          `${c.inicio} ${ruta} FCP ${p.fcpMs === null ? "—" : Math.round(p.fcpMs)} ms` +
            ` TTFB ${p.ttfbMs === null ? "—" : Math.round(p.ttfbMs)} ms` +
            ` cache ${p.cache ?? "—"} filas ${p.filasEnHtml}${p.fallo ? ` FALLO ${p.fallo}` : ""}`,
        );
      }
    }
  } finally {
    await browser.close();
  }
  const fin = new Date().toISOString();
  const pasadas = crudos.map(pasada);
  const json = path.join(args.salida, `${base}.json`);
  const md = path.join(args.salida, `${base}.md`);
  writeFileSync(
    json,
    `${JSON.stringify({ inicio, fin, url: args.url, rutas: args.rutas, n: args.n, pausaS: args.pausa, perfil: PERFIL_3G, navegador, pasadas: crudos.map((crudo, i) => ({ crudo, pasada: pasadas[i] })) }, null, 2)}\n`,
  );
  writeFileSync(
    md,
    informePintura({
      inicio,
      fin,
      url: args.url,
      perfil: PERFIL_3G,
      navegador,
      pausaS: args.pausa,
      nObjetivo: 20,
      rutas: args.rutas,
      pasadas,
      json: path.basename(json),
    }),
  );
  console.log(`informe: ${md}\ncrudo:   ${json}`);
}

if (import.meta.main) await main();

// SPEC-026: the first paint on a phone over 3G. Pure: every number of the
// report comes from here; tools/primera-pintura.mjs only drives Chromium and
// hands over what it saw (CrudoPasada).
import { percentil } from "../ingest/informe.ts";

// CA-3 (H-1): p75 of the FCP strictly below 2 s on each route.
export const UMBRAL_FCP_MS = 2000;
export const PERCENTIL = 0.75;
// CA-3: passes at least 15 s apart, so the sample includes CDN misses.
export const PAUSA_MIN_S = 15;

// CA-1: the profile lives in the tool; it travels here to be printed.
export type Perfil = {
  nombre: string;
  bajadaKbps: number;
  subidaKbps: number;
  rttMs: number;
  cpu: number;
  ancho: number;
  alto: number;
  dpr: number;
  movil: boolean;
};

export type FilasHtml = { filas: number; conDato: number };

// What the tool captures of one pass, before any interpretation. The served
// HTML is reduced to its rows (filasEnHtml) so the JSON stays small.
export type CrudoPasada = {
  ruta: string;
  inicio: string;
  status: number | null;
  cabeceras: { xVercelCache: string | null; age: string | null };
  filas: FilasHtml;
  navegacion: {
    responseStart: number;
    responseEnd: number;
    transferSize: number;
    encodedBodySize: number;
    domContentLoadedEventEnd: number;
  } | null;
  fcpMs: number | null;
  lcpMs: number | null;
  // performance.now() when the first [data-match-id] entered the DOM.
  primeraFilaMs: number | null;
  // TTFB of the document as the emulated network sees it: CDP
  // responseReceived − requestWillBeSent. Navigation Timing's responseStart
  // does not include the latency CDP adds, so this one wins when present.
  ttfbRedMs: number | null;
  recursos: {
    name: string;
    startTime: number;
    transferSize: number;
    encodedBodySize: number;
  }[];
  error: string | null;
};

export type Pasada = {
  ruta: string;
  inicio: string;
  ttfbMs: number | null;
  transferenciaMs: number | null;
  renderMs: number | null;
  fcpMs: number | null;
  lcpMs: number | null;
  bytesDocumento: number;
  bytesJs: number;
  bytesCss: number;
  cache: string | null;
  ageS: number | null;
  filasEnHtml: number;
  datoEnHtml: boolean;
  filasAlFcp: boolean;
  fallo: string | null;
};

// CA-2: rows of the served HTML (no JS run) and how many carry a score or a
// kickoff time. React may split text with <!-- --> separators.
export function filasEnHtml(html: string): FilasHtml {
  const trozos = html
    .replaceAll("<!-- -->", "")
    .split("data-match-id=")
    .slice(1);
  let conDato = 0;
  for (const trozo of trozos) {
    const fin = trozo.indexOf("</li>");
    const fila = fin === -1 ? trozo : trozo.slice(0, fin);
    const marcador = /data-testid="score"[^>]*>\s*\d+\s*</.test(fila);
    const hora =
      /data-testid="match-margin"[^>]*>(?:<span[^>]*><\/span>)?\s*\d{1,2}:\d{2}\s*</.test(
        fila,
      );
    if (marcador || hora) conDato += 1;
  }
  return { filas: trozos.length, conDato };
}

const tamano = (r: { transferSize: number; encodedBodySize: number }) =>
  r.transferSize > 0 ? r.transferSize : r.encodedBodySize;

const extension = (url: string) => {
  try {
    return new URL(url).pathname.split(".").at(-1) ?? "";
  } catch {
    return "";
  }
};

export function pasada(c: CrudoPasada): Pasada {
  const nav = c.navegacion;
  const ttfb = c.ttfbRedMs ?? nav?.responseStart ?? null;
  // JS/CSS inicial: what the page asked for before DOMContentLoaded.
  const iniciales = c.recursos.filter(
    (r) => nav !== null && r.startTime <= nav.domContentLoadedEventEnd,
  );
  const bytes = (ext: string) =>
    iniciales
      .filter((r) => extension(r.name) === ext)
      .reduce((s, r) => s + tamano(r), 0);
  const datoEnHtml = c.filas.conDato > 0;
  const filasAlFcp =
    c.fcpMs !== null && c.primeraFilaMs !== null && c.primeraFilaMs <= c.fcpMs;
  const age = c.cabeceras.age === null ? Number.NaN : Number(c.cabeceras.age);
  const fallo =
    c.error !== null
      ? `error: ${c.error}`
      : c.status !== 200
        ? `HTTP ${c.status ?? "sin respuesta"}`
        : !datoEnHtml
          ? "sin dato en el HTML"
          : c.fcpMs === null
            ? "sin FCP"
            : !filasAlFcp
              ? "FCP sin filas en el DOM"
              : null;
  return {
    ruta: c.ruta,
    inicio: c.inicio,
    ttfbMs: ttfb,
    transferenciaMs:
      nav && ttfb !== null ? Math.max(0, nav.responseEnd - ttfb) : null,
    renderMs: nav && c.fcpMs !== null ? c.fcpMs - nav.responseEnd : null,
    fcpMs: c.fcpMs,
    lcpMs: c.lcpMs,
    bytesDocumento: nav ? tamano(nav) : 0,
    bytesJs: bytes("js"),
    bytesCss: bytes("css"),
    cache: c.cabeceras.xVercelCache,
    ageS: Number.isFinite(age) ? age : null,
    filasEnHtml: c.filas.filas,
    datoEnHtml,
    filasAlFcp,
    fallo,
  };
}

export type Tramo = "TTFB" | "transferencia" | "render";

export type ResumenRuta = {
  ruta: string;
  n: number;
  fallos: number;
  mediana: number | null;
  p75: number | null;
  maximo: number | null;
  ttfb: number | null;
  transferencia: number | null;
  render: number | null;
  lcp: number | null;
  bytesDocumento: number | null;
  bytesJs: number | null;
  bytesCss: number | null;
  cache: Record<string, number>;
  cumple: boolean;
  // CA-4: where the time goes, only when the route does not comply.
  tramo: Tramo | null;
};

const mediana = (xs: (number | null)[]) =>
  percentil(
    xs.filter((x): x is number => x !== null),
    0.5,
  );

export function resumenRuta(ruta: string, pasadas: Pasada[]): ResumenRuta {
  const ps = pasadas.filter((p) => p.ruta === ruta);
  // A pass that never painted is infinitely slow, never discarded.
  const fcps = ps.map((p) => p.fcpMs ?? Number.POSITIVE_INFINITY);
  const p75 = percentil(fcps, PERCENTIL);
  const fallos = ps.filter((p) => p.fallo !== null).length;
  const cumple =
    ps.length > 0 && fallos === 0 && p75 !== null && p75 < UMBRAL_FCP_MS;
  const cache: Record<string, number> = {};
  for (const p of ps) {
    const k = p.cache ?? "(sin cabecera)";
    cache[k] = (cache[k] ?? 0) + 1;
  }
  const ttfb = mediana(ps.map((p) => p.ttfbMs));
  const transferencia = mediana(ps.map((p) => p.transferenciaMs));
  const render = mediana(ps.map((p) => p.renderMs));
  const tramos: [Tramo, number | null][] = [
    ["TTFB", ttfb],
    ["transferencia", transferencia],
    ["render", render],
  ];
  const dominante = tramos.reduce((a, b) =>
    (b[1] ?? -1) > (a[1] ?? -1) ? b : a,
  );
  return {
    ruta,
    n: ps.length,
    fallos,
    mediana: percentil(fcps, 0.5),
    p75,
    maximo: percentil(fcps, 1),
    ttfb,
    transferencia,
    render,
    lcp: mediana(ps.map((p) => p.lcpMs)),
    bytesDocumento: mediana(ps.map((p) => p.bytesDocumento)),
    bytesJs: mediana(ps.map((p) => p.bytesJs)),
    bytesCss: mediana(ps.map((p) => p.bytesCss)),
    cache,
    cumple,
    tramo: cumple || dominante[1] === null ? null : dominante[0],
  };
}

export type Veredicto = {
  estado: "cumple" | "no-cumple" | "no-valida";
  motivos: string[];
};

export function veredicto(
  resumenes: ResumenRuta[],
  o: { pausaS: number; nObjetivo: number; rutas: string[] },
): Veredicto {
  const invalidez: string[] = [];
  if (o.pausaS < PAUSA_MIN_S)
    invalidez.push(`pausa ${o.pausaS} s < ${PAUSA_MIN_S} s`);
  for (const ruta of o.rutas) {
    const r = resumenes.find((x) => x.ruta === ruta);
    if (!r || r.n === 0) invalidez.push(`${ruta}: sin pasadas`);
    else if (r.n < o.nObjetivo)
      invalidez.push(`${ruta}: n = ${r.n} < ${o.nObjetivo}`);
  }
  if (invalidez.length > 0) return { estado: "no-valida", motivos: invalidez };
  const motivos: string[] = [];
  for (const r of resumenes) {
    if (r.fallos > 0)
      motivos.push(`${r.ruta}: ${r.fallos} pasada(s) con fallo`);
    if (r.p75 !== null && r.p75 >= UMBRAL_FCP_MS)
      motivos.push(`${r.ruta}: p75 ${ms(r.p75)} ≥ ${UMBRAL_FCP_MS} ms`);
  }
  return { estado: motivos.length === 0 ? "cumple" : "no-cumple", motivos };
}

const ms = (x: number | null) =>
  x === null ? "—" : Number.isFinite(x) ? `${Math.round(x)} ms` : "sin pintura";
const n0 = (x: number | null) =>
  x === null ? "—" : Number.isFinite(x) ? String(Math.round(x)) : "∞";
const kb = (x: number | null) => (x === null ? "—" : (x / 1024).toFixed(1));

export function describirPerfil(p: Perfil): string {
  return (
    `«${p.nombre}»: red ${p.bajadaKbps} kbit/s de bajada, ${p.subidaKbps} kbit/s de subida, ` +
    `RTT ${p.rttMs} ms (CDP Network.emulateNetworkConditions) · CPU ×${p.cpu} ` +
    `(Emulation.setCPUThrottlingRate) · ${p.ancho} × ${p.alto}, DPR ${p.dpr}` +
    `${p.movil ? ", isMobile" : ""} · contexto nuevo por pasada (caché y almacenamiento vacíos)`
  );
}

const ETIQUETA: Record<Veredicto["estado"], string> = {
  cumple: "CUMPLE",
  "no-cumple": "NO CUMPLE",
  "no-valida": "MUESTRA NO VÁLIDA",
};

export function informePintura(e: {
  inicio: string;
  fin: string;
  url: string;
  perfil: Perfil;
  navegador: string;
  pausaS: number;
  nObjetivo: number;
  rutas: string[];
  pasadas: Pasada[];
  json: string;
}): string {
  const resumenes = e.rutas.map((r) => resumenRuta(r, e.pasadas));
  const v = veredicto(resumenes, e);
  const filas = resumenes.map((r) =>
    [
      r.ruta,
      r.n,
      n0(r.mediana),
      n0(r.p75),
      n0(r.maximo),
      r.fallos,
      Object.entries(r.cache)
        .map(([k, c]) => `${k} ${c}`)
        .join(", "),
      n0(r.ttfb),
      n0(r.transferencia),
      n0(r.render),
      n0(r.lcp),
      kb(r.bytesDocumento),
      kb(r.bytesJs),
      kb(r.bytesCss),
      r.cumple ? "sí" : "no",
    ].join(" | "),
  );
  const fallidas = e.pasadas.filter((p) => p.fallo !== null);
  const lineas = [
    `# SPEC-026 — Primera pintura en móvil con 3G · ${e.inicio}`,
    "",
    `- Destino: ${e.url} · rutas ${e.rutas.join(", ")} alternas · n objetivo ${e.nObjetivo} por ruta · pausa ${e.pausaS} s · ${e.inicio} → ${e.fin}`,
    `- Perfil (CA-1) ${describirPerfil(e.perfil)} · ${e.navegador}`,
    `- Umbral (CA-3): p75 del FCP < ${UMBRAL_FCP_MS} ms en cada ruta y el dato en el HTML en todas las pasadas (percentil por rango más cercano).`,
    "",
    `**Veredicto: ${ETIQUETA[v.estado]}**${v.motivos.length ? ` — ${v.motivos.join("; ")}` : ""}`,
    "",
    "Tiempos en ms (mediana salvo FCP), bytes en kB (mediana; JS/CSS pedidos antes de DOMContentLoaded).",
    "",
    "| Ruta | n | FCP mediana | FCP p75 | FCP máx. | fallos | x-vercel-cache | TTFB | transferencia | render | LCP | doc kB | JS kB | CSS kB | cumple |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...filas.map((f) => `| ${f} |`),
  ];
  const lentas = resumenes.filter((r) => r.tramo !== null);
  if (lentas.length > 0) {
    lineas.push(
      "",
      "## Dónde se va el tiempo",
      "",
      "TTFB = cabeceras del documento en la red emulada (CDP); transferencia = responseEnd − TTFB; render = FCP − responseEnd.",
      "",
      ...lentas.map(
        (r) =>
          `- ${r.ruta}: ${r.tramo} (TTFB ${ms(r.ttfb)}, transferencia ${ms(r.transferencia)}, render ${ms(r.render)})`,
      ),
    );
  }
  if (fallidas.length > 0) {
    lineas.push(
      "",
      "## Pasadas con fallo",
      "",
      ...fallidas
        .slice(0, 10)
        .map((p) => `- ${p.inicio} ${p.ruta}: ${p.fallo}`),
      ...(fallidas.length > 10 ? [`- … y ${fallidas.length - 10} más`] : []),
    );
  }
  lineas.push("", `JSON crudo de cada pasada: \`${e.json}\``, "");
  return lineas.join("\n");
}

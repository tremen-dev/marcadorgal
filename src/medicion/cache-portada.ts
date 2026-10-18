import { formatTime } from "../i18n/format.ts";

// SPEC-030 CA-4: the pure half of tools/cache-portada.mjs. The tool waits,
// asks / and /es and hands over what it saw; every judgement is here.
//
// A response passes when the CDN did not serve the build's HTML (no
// PRERENDER) and its freshness line («Actualizado ás HH:MM», Europe/Madrid)
// is within 1 min of its Date header (the server's clock, D-9).

export const ESPERA_S = 65;
export const RONDAS = 5;
export const RUTAS = ["/", "/es"] as const;
// The freshness line says minutes; the render is at most 1 min off Date.
export const TOLERANCIA_MIN = 1;

// One response, as the tool writes it (a JSONL line).
export type RespuestaPortada = {
  ronda: number;
  ruta: string;
  // The probe's clock when the request left, ISO with Z.
  inicio: string;
  status: number | null;
  xVercelCache: string | null;
  age: string | null;
  // The Date header, as it came (RFC 9110 IMF-fixdate).
  date: string | null;
  // HH:MM of the freshness line, null if the HTML had none.
  frescura: string | null;
};

export type Juicio = { ok: true } | { ok: false; motivo: string };

// The served line of / and /es: «Actualizado ás 17:38» (gl) or
// «Actualizado a las 17:38» (es), inside data-testid="freshness-age".
export function frescuraEnHtml(html: string): string | null {
  const span = html.match(/data-testid="freshness-age"[^>]*>([^<]*)</);
  const time = span?.[1].match(/\b(\d{2}):(\d{2})\b/);
  return time ? `${time[1]}:${time[2]}` : null;
}

export function juzgar(r: RespuestaPortada): Juicio {
  if (r.status !== 200) return { ok: false, motivo: `status ${r.status}` };
  if (r.xVercelCache === "PRERENDER")
    return { ok: false, motivo: "PRERENDER (HTML del build)" };
  if (r.frescura === null)
    return { ok: false, motivo: "sin línea de frescura" };
  const date = r.date === null ? Number.NaN : Date.parse(r.date);
  if (Number.isNaN(date)) return { ok: false, motivo: "sin Date" };
  for (let k = -TOLERANCIA_MIN; k <= TOLERANCIA_MIN; k += 1)
    if (
      formatTime(new Date(date + k * 60_000).toISOString(), "gl") === r.frescura
    )
      return { ok: true };
  return {
    ok: false,
    motivo: `frescura ${r.frescura} a más de ${TOLERANCIA_MIN} min de Date (${formatTime(new Date(date).toISOString(), "gl")})`,
  };
}

export type Veredicto = {
  cumple: boolean;
  total: number;
  fallos: { respuesta: RespuestaPortada; motivo: string }[];
};

// CA-4: cumple if there is at least one response and none fails.
export function veredicto(respuestas: readonly RespuestaPortada[]): Veredicto {
  const fallos: Veredicto["fallos"] = [];
  for (const respuesta of respuestas) {
    const j = juzgar(respuesta);
    if (!j.ok) fallos.push({ respuesta, motivo: j.motivo });
  }
  return {
    cumple: respuestas.length > 0 && fallos.length === 0,
    total: respuestas.length,
    fallos,
  };
}

export function leerJsonl(texto: string): RespuestaPortada[] {
  return texto
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l) as RespuestaPortada);
}

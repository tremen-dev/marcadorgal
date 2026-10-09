import { z } from "zod";
import { Instant } from "../model/index.ts";

// SPEC-025 CA-3 (H-2): the pure parser of the JSONL that tools/sonda-pantalla.mjs
// writes. Every instant in it is the probe's clock (D-9): paintedAt and
// instante are read on the probe's machine; `date` is the Date header of
// /api/board, the server's clock, kept apart for the base ↔ probe joint.

export type Pintura = {
  // The file it came from: two probes running at once never mix their pages.
  origen: string;
  ruta: string;
  matchId: string;
  version: number;
  // "home-away", or null while the row has no score.
  marcador: string | null;
  estado: string;
  paintedAt: Instant;
  // The rows already on screen when the page loaded: they say what was there,
  // not when it arrived.
  inicial: boolean;
};

export type Respuesta = {
  origen: string;
  ruta: string;
  estado: number;
  // Seconds the response spent in the CDN (Age), null without the header.
  age: number | null;
  xVercelCache: string | null;
  // The server's Date header as an Instant (resolution 1 s), or null.
  date: Instant | null;
  instante: Instant;
};

export type Visibilidad = {
  origen: string;
  ruta: string;
  estado: string;
  instante: Instant;
};

export type ErrorSonda = { ruta: string; mensaje: string; instante: Instant };

export type LineaInvalida = { fichero: string; linea: number; motivo: string };

export type Sonda = {
  inicios: Instant[];
  fines: Instant[];
  pinturas: Pintura[];
  respuestas: Respuesta[];
  visibilidad: Visibilidad[];
  noVisibles: number;
  erroresSonda: ErrorSonda[];
  lineasInvalidas: LineaInvalida[];
};

const Linea = z.discriminatedUnion("tipo", [
  z.looseObject({ tipo: z.literal("inicio"), instante: Instant }),
  z.looseObject({ tipo: z.literal("fin"), instante: Instant }),
  z.looseObject({
    tipo: z.literal("pintura"),
    ruta: z.string(),
    matchId: z.string().min(1),
    version: z.int().min(0),
    marcador: z.string().nullable(),
    estado: z.string(),
    paintedAt: Instant,
    inicial: z.boolean(),
  }),
  z.looseObject({
    tipo: z.literal("respuesta"),
    ruta: z.string(),
    estado: z.int(),
    age: z.string().nullable(),
    xVercelCache: z.string().nullable(),
    date: z.string().nullable(),
    instante: Instant,
  }),
  z.looseObject({
    tipo: z.literal("visibilidad"),
    ruta: z.string(),
    estado: z.string(),
    instante: Instant,
  }),
  z.looseObject({
    tipo: z.literal("error"),
    ruta: z.string(),
    mensaje: z.string(),
    instante: Instant,
  }),
]);

const ageOf = (value: string | null): number | null => {
  if (value === null || !/^\d+$/.test(value.trim())) return null;
  return Number(value.trim());
};

const dateOf = (value: string | null): Instant | null => {
  if (value === null) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
};

const vacia = (): Sonda => ({
  inicios: [],
  fines: [],
  pinturas: [],
  respuestas: [],
  visibilidad: [],
  noVisibles: 0,
  erroresSonda: [],
  lineasInvalidas: [],
});

export function parseSonda(texto: string, fichero: string): Sonda {
  const out = vacia();
  const lineas = texto.split("\n");
  for (let i = 0; i < lineas.length; i += 1) {
    const raw = lineas[i].trim();
    if (raw === "") continue;
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      out.lineasInvalidas.push({ fichero, linea: i + 1, motivo: "no es JSON" });
      continue;
    }
    const parsed = Linea.safeParse(json);
    if (!parsed.success) {
      out.lineasInvalidas.push({
        fichero,
        linea: i + 1,
        motivo: parsed.error.issues[0]?.message ?? "forma desconocida",
      });
      continue;
    }
    const l = parsed.data;
    switch (l.tipo) {
      case "inicio":
        out.inicios.push(l.instante);
        break;
      case "fin":
        out.fines.push(l.instante);
        break;
      case "pintura":
        out.pinturas.push({
          origen: fichero,
          ruta: l.ruta,
          matchId: l.matchId,
          version: l.version,
          marcador: l.marcador,
          estado: l.estado,
          paintedAt: l.paintedAt,
          inicial: l.inicial,
        });
        break;
      case "respuesta":
        out.respuestas.push({
          origen: fichero,
          ruta: l.ruta,
          estado: l.estado,
          age: ageOf(l.age),
          xVercelCache: l.xVercelCache,
          date: dateOf(l.date),
          instante: l.instante,
        });
        break;
      case "visibilidad":
        out.visibilidad.push({
          origen: fichero,
          ruta: l.ruta,
          estado: l.estado,
          instante: l.instante,
        });
        if (l.estado !== "visible") out.noVisibles += 1;
        break;
      case "error":
        out.erroresSonda.push({
          ruta: l.ruta,
          mensaje: l.mensaje,
          instante: l.instante,
        });
        break;
    }
  }
  return out;
}

const byInstant =
  <T>(key: (x: T) => string) =>
  (a: T, b: T) =>
    key(a).localeCompare(key(b));

// Several files (several runs, or two probes at once) as one probe, every
// list ordered by the probe's clock.
export function unirSondas(sondas: readonly Sonda[]): Sonda {
  const out = vacia();
  for (const s of sondas) {
    out.inicios.push(...s.inicios);
    out.fines.push(...s.fines);
    out.pinturas.push(...s.pinturas);
    out.respuestas.push(...s.respuestas);
    out.visibilidad.push(...s.visibilidad);
    out.noVisibles += s.noVisibles;
    out.erroresSonda.push(...s.erroresSonda);
    out.lineasInvalidas.push(...s.lineasInvalidas);
  }
  out.inicios.sort();
  out.fines.sort();
  out.pinturas.sort(byInstant((p) => p.paintedAt));
  out.respuestas.sort(byInstant((r) => r.instante));
  out.visibilidad.sort(byInstant((v) => v.instante));
  return out;
}

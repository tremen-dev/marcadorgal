import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type AliasFile, type Instant, MINUTE_MS, shiftInstant } from "@/model";
import {
  APENDICE,
  type Evidencia,
  type ExportFichero,
  INFORME_RFEF_MAX_LINEAS,
  type InformeRfefInput,
  informeRfef,
  parseEvidencia,
  type RfefAlert,
  type RfefDecision,
  type RfefMatch,
  type RfefObservation,
} from "./informe-rfef.ts";

// SPEC-039 CA-1/CA-2/CA-4/CA-5: the arithmetic of the rfef report over fixed
// rows of observations, alerts and ingest_attempts and fixed exports. No
// database, no clock, no network.

const DESDE = "2026-11-06T17:00:00.000Z" as Instant;
const HASTA = "2026-11-09T22:00:00.000Z" as Instant;
const KICKOFF0 = "2026-11-07T10:00:00.000Z" as Instant;
const FECHA = "2026-11-07";
const SEC = 1_000;
const COMPS = [
  "primera-division",
  "segunda-division",
  "primera-rfef-g1",
  "segunda-rfef-g1",
  "tercera-rfef-g1",
];
const grupo = (comp: string) => `G-${comp}`;
const plus = (i: Instant, ms: number) => shiftInstant(i, ms);

// One competition's matchday, built from a recipe: n matches, each with one
// goal (1-0) that API-Football sees at kickoff+30' and the rfef deltaS later.
type Receta = {
  n: number;
  deltaS?: number;
  rfefFinal?: (i: number) => [number, number];
  acta?: boolean;
  strategy?: (i: number) => string;
};

type Mundo = {
  matches: RfefMatch[];
  observations: RfefObservation[];
  rows: Record<string, unknown>[];
  actaRows: Record<string, unknown>[];
  teams: { externalId: string; externalName: string; teamId: string }[];
};

const vacio = (): Mundo => ({
  matches: [],
  observations: [],
  rows: [],
  actaRows: [],
  teams: [],
});

let seq = 0;
const obs = (
  o: Omit<RfefObservation, "id" | "observedAt" | "recordedAt"> & {
    observedAt?: Instant;
    recordedAt?: Instant | null;
  },
): RfefObservation => {
  seq += 1;
  return {
    id: `o-${String(seq).padStart(5, "0")}`,
    observedAt: o.observedAt ?? o.receivedAt,
    recordedAt:
      o.recordedAt === undefined ? plus(o.receivedAt, 2 * SEC) : o.recordedAt,
    ...o,
  };
};

const fila = (
  comp: string,
  i: number,
  home: string,
  away: string,
  score: [number, number] | null,
  estado: string,
  strategy: string,
) => ({
  codActa: null,
  codGrupo: grupo(comp),
  codCompeticion: "C",
  jornada: "12",
  fechaIso: FECHA,
  horaTexto: "11:00",
  codEquipoLocal: null,
  equipoLocal: home,
  codEquipoVisitante: null,
  equipoVisitante: away,
  golesLocal: score === null ? null : score[0],
  golesVisitante: score === null ? null : score[1],
  estado,
  lastSeenAt: plus(KICKOFF0, (100 + i) * MINUTE_MS),
  lastChangedAt: plus(KICKOFF0, (100 + i) * MINUTE_MS),
  strategy,
  discardedReadings: 0,
});

function competicion(w: Mundo, comp: string, r: Receta): Mundo {
  for (let i = 0; i < r.n; i += 1) {
    const id = `${comp}-m${i}`;
    const kickoff = plus(KICKOFF0, i * 3 * 60 * MINUTE_MS);
    const home = `Local ${comp} ${i}`;
    const away = `Visita ${comp} ${i}`;
    w.teams.push(
      { externalId: home.toLowerCase(), externalName: home, teamId: `${id}-h` },
      { externalId: away.toLowerCase(), externalName: away, teamId: `${id}-a` },
    );
    w.matches.push({
      id,
      competitionId: comp,
      competitionName: comp,
      round: 12,
      kickoff,
      homeTeamId: `${id}-h`,
      awayTeamId: `${id}-a`,
      homeName: home,
      awayName: away,
      status: "finished",
      score: { home: 1, away: 0 },
    });
    const gol = plus(kickoff, 30 * MINUTE_MS);
    const rfefGol = plus(gol, (r.deltaS ?? 0) * SEC);
    const fin = plus(kickoff, 110 * MINUTE_MS);
    const final = r.rfefFinal?.(i) ?? [1, 0];
    w.observations.push(
      obs({
        matchId: id,
        sourceId: "api-football",
        status: "live",
        score: { home: 0, away: 0 },
        receivedAt: plus(kickoff, MINUTE_MS),
      }),
      obs({
        matchId: id,
        sourceId: "api-football",
        status: "live",
        score: { home: 1, away: 0 },
        receivedAt: gol,
      }),
      obs({
        matchId: id,
        sourceId: "rfef",
        status: "live",
        score: { home: 0, away: 0 },
        receivedAt: plus(kickoff, MINUTE_MS),
      }),
      obs({
        matchId: id,
        sourceId: "rfef",
        status: "live",
        score: { home: 1, away: 0 },
        receivedAt: rfefGol,
      }),
      obs({
        matchId: id,
        sourceId: "api-football",
        status: "finished",
        score: { home: 1, away: 0 },
        receivedAt: fin,
      }),
      obs({
        matchId: id,
        sourceId: "rfef",
        status: "finished",
        score: { home: final[0], away: final[1] },
        receivedAt: fin,
      }),
    );
    const strategy = r.strategy?.(i) ?? "static:packed_ntype";
    w.rows.push(fila(comp, i, home, away, final, "FINISHED", strategy));
    if (r.acta !== false)
      w.actaRows.push(fila(comp, i, home, away, [1, 0], "FINISHED", strategy));
  }
  return w;
}

const exportDe = (
  fichero: string,
  exportedAt: string,
  matches: Record<string, unknown>[],
  date = FECHA,
): ExportFichero => ({
  fichero,
  contenido: JSON.stringify({ exportedAt, date, matches }),
});

// A single match outside the recipe, with its aliases and, if given, its acta
// row in the export of the day after.
function suelto(
  w: Mundo,
  comp: string,
  id: string,
  kickoff: Instant,
  acta: [number, number] | null,
  names: [string, string] = [`Local ${id}`, `Visita ${id}`],
): RfefMatch {
  const [home, away] = names;
  w.teams.push(
    { externalId: home.toLowerCase(), externalName: home, teamId: `${id}-h` },
    { externalId: away.toLowerCase(), externalName: away, teamId: `${id}-a` },
  );
  const m: RfefMatch = {
    id,
    competitionId: comp,
    competitionName: comp,
    round: 12,
    kickoff,
    homeTeamId: `${id}-h`,
    awayTeamId: `${id}-a`,
    homeName: home,
    awayName: away,
    status: "live",
    score: { home: 0, away: 0 },
  };
  w.matches.push(m);
  if (acta !== null)
    w.actaRows.push(fila(comp, 0, home, away, acta, "FINISHED", "static:a"));
  return m;
}

const decision = (
  matchId: string,
  version: number,
  decidedAt: Instant,
  status: RfefDecision["status"],
  winnerSourceId: string | null,
): RfefDecision => ({ matchId, version, decidedAt, status, winnerSourceId });

const evidenciaLimpia = (): Evidencia => ({
  explorer: {
    capturadoEn: "2026-11-09T23:00:00.000Z",
    health: { ok: true },
    sesiones: 30,
    softBlocks: 12,
    sondeosSaltados: 40,
    cooldowns: [],
    anomalias: [],
  },
  intervenciones: [],
});

function input(
  w: Mundo,
  extra: Partial<InformeRfefInput> = {},
): InformeRfefInput {
  return {
    desde: DESDE,
    hasta: HASTA,
    competiciones: COMPS,
    matches: w.matches,
    observations: w.observations,
    alerts: [],
    attempts: [],
    decisions: [],
    exportsDelDia: [
      exportDe("export-dia.json", "2026-11-07T22:59:00.000Z", w.rows),
    ],
    exportsActa: [
      exportDe("export-acta.json", "2026-11-08T10:00:00.000Z", w.actaRows),
    ],
    aliases: {
      source: "rfef",
      season: "2026-27",
      competitions: Object.fromEntries(COMPS.map((c) => [grupo(c), c])),
      teams: w.teams,
    } as AliasFile,
    evidencia: evidenciaLimpia(),
    ...extra,
  };
}

const de = (r: ReturnType<typeof informeRfef>, comp: string) => {
  const c = r.competiciones.find((x) => x.competitionId === comp);
  if (c === undefined) throw new Error(comp);
  return c;
};

const T = "tercera-rfef-g1";

describe("SPEC-039 CA-1 (a) volumen", () => {
  it("counts matches and observations of each source per competition, every competition listed", () => {
    const r = informeRfef(input(competicion(vacio(), T, { n: 2 })));
    expect(r.competiciones.map((c) => c.competitionId)).toEqual(COMPS);
    expect(de(r, T)).toMatchObject({
      partidos: 2,
      obsRfef: 6,
      obsApiFootball: 6,
    });
    expect(de(r, "primera-division")).toMatchObject({
      partidos: 0,
      obsRfef: 0,
    });
  });
});

describe("SPEC-039 CA-1 (b) desfase por gol", () => {
  it("Δ = recordedAt of the first rfef observation with the score − the first API-Football one; 0-0 is not a change", () => {
    const r = informeRfef(input(competicion(vacio(), T, { n: 3, deltaS: 20 })));
    const d = de(r, T).desfase;
    expect(d.n).toBe(3);
    expect(
      d.deltas.every((x) => x.marcador === "1-0" && x.deltaMs === 20 * SEC),
    ).toBe(true);
    expect(d.medianaMs).toBe(20 * SEC);
    expect(d.p95Ms).toBe(20 * SEC);
  });

  it("uses the second clock and not observedAt, and counts the pairs without it apart", () => {
    const w = competicion(vacio(), T, { n: 2, deltaS: -10 });
    // observedAt of the rfef is explorer's lastSeenAt: far from the base's clock.
    for (const o of w.observations)
      if (o.sourceId === "rfef")
        o.observedAt = plus(o.receivedAt, -40 * MINUTE_MS);
    const sinReloj = w.observations.find(
      (o) =>
        o.matchId === `${T}-m1` &&
        o.sourceId === "rfef" &&
        o.score?.home === 1 &&
        o.status === "live",
    );
    if (sinReloj) sinReloj.recordedAt = null;
    const d = de(informeRfef(input(w)), T).desfase;
    expect(d.n).toBe(1);
    expect(d.deltas[0].deltaMs).toBe(-10 * SEC);
    expect(d.sinReloj).toBe(1);
  });

  it("a score only one source saw is not a Δ; median and p95 are nearest rank", () => {
    const w = vacio();
    competicion(w, T, { n: 4, deltaS: 0 });
    // Shift each match's rfef goal: 0, 10, 30, 60 s.
    [0, 10, 30, 60].forEach((s, i) => {
      const o = w.observations.find(
        (x) =>
          x.matchId === `${T}-m${i}` &&
          x.sourceId === "rfef" &&
          x.status === "live" &&
          x.score?.home === 1,
      );
      if (o?.recordedAt) o.recordedAt = plus(o.recordedAt, s * SEC);
    });
    w.observations.push(
      obs({
        matchId: `${T}-m0`,
        sourceId: "rfef",
        status: "live",
        score: { home: 2, away: 0 },
        receivedAt: plus(KICKOFF0, 50 * MINUTE_MS),
      }),
    );
    const d = de(informeRfef(input(w)), T).desfase;
    expect(d.n).toBe(4);
    expect(d.medianaMs).toBe(10 * SEC);
    expect(d.p95Ms).toBe(60 * SEC);
  });
});

describe("SPEC-039 CA-1 (c) cobertura", () => {
  // rfef live every minute from 1' to 10' (9 intervals of 1 min) at 0-0,
  // while API-Football still says scheduled from before the kickoff.
  const silencioAf = (w: Mundo, id: string, kickoff: Instant) =>
    w.observations.push(
      obs({
        matchId: id,
        sourceId: "api-football",
        status: "scheduled",
        score: null,
        receivedAt: plus(kickoff, -5 * MINUTE_MS),
      }),
      ...Array.from({ length: 10 }, (_, k) =>
        obs({
          matchId: id,
          sourceId: "rfef",
          status: "live",
          score: { home: 0, away: 0 },
          receivedAt: plus(kickoff, (k + 1) * MINUTE_MS),
        }),
      ),
    );

  it("counts rfef live while API-Football says scheduled past the kickoff or is silent ≥ 15 min, and the minutes", () => {
    const w = vacio();
    const id = `${T}-x`;
    suelto(w, T, id, KICKOFF0, [0, 0]);
    silencioAf(w, id, KICKOFF0);
    const c = de(informeRfef(input(w)), T).cobertura;
    expect(c.observado).toEqual({ partidos: [id], minutos: 9 });
  });

  it("does not count while API-Football gives a fresh live", () => {
    const w = competicion(vacio(), T, { n: 1 });
    const c = de(informeRfef(input(w)), T).cobertura;
    expect(c.observado).toEqual({ partidos: [], minutos: 0 });
  });

  it("an interval is capped at the freshness of RN-01 (5 min)", () => {
    const w = vacio();
    const id = `${T}-y`;
    suelto(w, T, id, KICKOFF0, [0, 0]);
    w.observations.push(
      obs({
        matchId: id,
        sourceId: "rfef",
        status: "live",
        score: { home: 0, away: 0 },
        receivedAt: plus(KICKOFF0, MINUTE_MS),
      }),
      obs({
        matchId: id,
        sourceId: "rfef",
        status: "live",
        score: { home: 0, away: 0 },
        receivedAt: plus(KICKOFF0, 21 * MINUTE_MS),
      }),
    );
    expect(de(informeRfef(input(w)), T).cobertura.observado.minutos).toBe(5);
  });

  it("publicado counts only while the current Decision is live with the rfef as winner", () => {
    const w = vacio();
    const id = `${T}-x`;
    suelto(w, T, id, KICKOFF0, [0, 0]);
    silencioAf(w, id, KICKOFF0);
    const decisions = [
      decision(id, 1, plus(KICKOFF0, -60 * MINUTE_MS), "scheduled", null),
      // 1'..4' api-football's stale live, 4'..10' the rfef's: 6 min.
      decision(id, 2, plus(KICKOFF0, 30 * SEC), "live", "api-football"),
      decision(id, 3, plus(KICKOFF0, 4 * MINUTE_MS), "live", "rfef"),
      decision(id, 4, plus(KICKOFF0, 10 * MINUTE_MS), "live", "operator"),
    ];
    const r = informeRfef(input(w, { decisions }));
    const c = de(r, T).cobertura;
    expect(c.observado.minutos).toBe(9);
    expect(c.publicado).toEqual({ partidos: [id], minutos: 6 });
    expect(c.observoSinDecidir).toBe(false);
    expect(r.texto).not.toContain("la rfef observó sin decidir");
  });

  it("observed > 0 and published 0 says «la rfef observó sin decidir» (liveObservedOnly)", () => {
    const w = vacio();
    const id = `${T}-x`;
    suelto(w, T, id, KICKOFF0, [0, 0]);
    silencioAf(w, id, KICKOFF0);
    const r = informeRfef(input(w));
    const c = de(r, T).cobertura;
    expect(c.publicado).toEqual({ partidos: [], minutos: 0 });
    expect(c.observoSinDecidir).toBe(true);
    const fila1 = r.texto.split("\n").find((l) => l.startsWith(`| ${T} | 1 |`));
    expect(fila1).toContain("la rfef observó sin decidir");
    expect(fila1).toContain("obs. 1 p, 9 min");
    expect(fila1).toContain("pub. 0 p, 0 min");
  });

  it("matches without acta or with ≠ acta en directo do not add: they are listed apart", () => {
    const w = vacio();
    const sinActa = `${T}-s`;
    const distinto = `${T}-d`;
    suelto(w, T, sinActa, KICKOFF0, null);
    suelto(w, T, distinto, plus(KICKOFF0, 180 * MINUTE_MS), [1, 0]);
    silencioAf(w, sinActa, KICKOFF0);
    silencioAf(w, distinto, plus(KICKOFF0, 180 * MINUTE_MS));
    const r = informeRfef(input(w));
    const c = de(r, T).cobertura;
    expect(c.observado).toEqual({ partidos: [], minutos: 0 });
    expect(c.observoSinDecidir).toBe(false);
    expect(c.aparte).toEqual([
      { matchId: sinActa, motivo: "sin acta" },
      { matchId: distinto, motivo: "≠ acta en directo" },
    ]);
    expect(r.texto).toContain(`${sinActa} (sin acta)`);
  });
});

describe("SPEC-039 CA-1 (d) alertas con la rfef como parte", () => {
  it("conflict with rfef as winner, rival or recovery source, and regression (RN-03) by the rfef, with duration", () => {
    const w = competicion(vacio(), T, { n: 1 });
    const m = `${T}-m0`;
    const at = plus(KICKOFF0, 40 * MINUTE_MS);
    const alerts: RfefAlert[] = [
      {
        kind: "conflict",
        matchId: m,
        openedAt: at,
        resolvedAt: plus(at, 90 * SEC),
        details: {
          winner: { sourceId: "api-football" },
          rival: { sourceId: "rfef" },
        },
      },
      {
        kind: "conflict",
        matchId: m,
        openedAt: at,
        resolvedAt: null,
        details: { sourceId: "rfef", current: {}, proposed: {} },
      },
      {
        kind: "regression",
        matchId: m,
        openedAt: at,
        resolvedAt: plus(at, 60 * SEC),
        details: { sourceId: "rfef" },
      },
      {
        kind: "regression",
        matchId: m,
        openedAt: at,
        resolvedAt: null,
        details: { sourceId: "api-football" },
      },
      {
        kind: "conflict",
        matchId: m,
        openedAt: at,
        resolvedAt: null,
        details: {
          winner: { sourceId: "operator" },
          rival: { sourceId: "api-football" },
        },
      },
      {
        kind: "silence",
        matchId: m,
        openedAt: at,
        resolvedAt: null,
        details: {},
      },
    ];
    const a = de(informeRfef(input(w, { alerts })), T).alertas;
    expect(a.map((x) => [x.kind, x.duracionMs])).toEqual([
      ["conflict", 90 * SEC],
      ["conflict", null],
      ["RN-03", 60 * SEC],
    ]);
  });
});

describe("SPEC-039 CA-1 (e) fallos y descartes", () => {
  it("groups rfef attempts with ok = false by reason, sums fueraDeVentana and counts future observedAt", () => {
    const w = competicion(vacio(), T, { n: 1 });
    w.observations.push(
      obs({
        matchId: `${T}-m0`,
        sourceId: "rfef",
        status: "live",
        score: { home: 1, away: 0 },
        receivedAt: plus(KICKOFF0, 50 * MINUTE_MS),
        observedAt: plus(KICKOFF0, 51 * MINUTE_MS),
      }),
    );
    const a = (
      ok: boolean | null,
      error: string | null,
      fuera = 0,
      sourceId = "rfef",
    ) => ({
      sourceId,
      startedAt: KICKOFF0,
      ok,
      error,
      fueraDeVentana: fuera,
    });
    const r = informeRfef(
      input(w, {
        attempts: [
          a(true, null, 7),
          a(true, null, 3),
          a(false, "rfef explorer responded 503"),
          a(false, "rfef explorer responded 503"),
          a(
            false,
            "rfef: 1 de 1 peticiones con error del proveedor: empty body",
          ),
          a(null, null),
          a(false, "api-football down", 0, "api-football"),
        ],
      }),
    );
    expect(r.intentos).toEqual({
      total: 6,
      fallidos: 4,
      fueraDeVentana: 10,
      porMotivo: [
        ["rfef explorer responded 503", 2],
        ["rfef: 1 de 1 peticiones con error del proveedor: empty body", 1],
        ["sin cerrar", 1],
      ],
    });
    expect(de(r, T).futuras).toBe(1);
  });
});

describe("SPEC-039 CA-1 (f) strategy y discardedReadings", () => {
  it("reads the newest export of each day and counts per competition", () => {
    const w = competicion(vacio(), T, {
      n: 4,
      strategy: (i) => (i === 3 ? "vm:inline" : "static:packed_ntype"),
    });
    w.rows[0].discardedReadings = 2;
    const viejo = exportDe("export-viejo.json", "2026-11-07T12:00:00.000Z", []);
    const r = informeRfef(
      input(w, {
        exportsDelDia: [
          exportDe("export-dia.json", "2026-11-07T22:59:00.000Z", w.rows),
          viejo,
        ],
      }),
    );
    expect(de(r, T).estrategias).toMatchObject({
      filas: 4,
      conMarcador: 4,
      estaticas: 3,
      descartadas: 2,
      porEstrategia: [
        ["static:packed_ntype", 3],
        ["vm:inline", 1],
      ],
    });
    expect(de(r, T).estrategias.noEstaticas[0]).toContain("vm:inline");
    expect(r.texto).toContain("export-dia.json");
    expect(r.texto).not.toContain("export-viejo.json");
  });

  it("rejects a file that is not an export of explorer", () => {
    expect(() =>
      informeRfef(
        input(vacio(), {
          exportsDelDia: [{ fichero: "x.json", contenido: "{}" }],
        }),
      ),
    ).toThrow(/x.json/);
  });
});

describe("SPEC-039 CA-2 contraste con acta cerrada", () => {
  it("counts triple matches, discrepancies per source, matches without acta and false digits", () => {
    const w = competicion(vacio(), T, {
      n: 4,
      rfefFinal: (i) => (i === 1 ? [2, 0] : [1, 0]),
    });
    // m2: API-Football closed 1-1; m3: no acta the day after.
    const af = w.observations.find(
      (o) =>
        o.matchId === `${T}-m2` &&
        o.sourceId === "api-football" &&
        o.status === "finished",
    );
    if (af) af.score = { home: 1, away: 1 };
    w.actaRows.pop();
    const c = de(informeRfef(input(w)), T).acta;
    expect(c).toMatchObject({
      triples: 2,
      difApiFootball: 1,
      difDecision: 0,
      difRfef: 1,
      sinActa: 1,
      digitosFalsos: 1,
    });
    expect(c.partidos.find((p) => p.matchId === `${T}-m3`)?.acta).toBeNull();
  });

  it("a live rfef observation above the acta on one side is a false digit", () => {
    const w = competicion(vacio(), T, { n: 1 });
    w.observations.push(
      obs({
        matchId: `${T}-m0`,
        sourceId: "rfef",
        status: "live",
        score: { home: 0, away: 1 },
        receivedAt: plus(KICKOFF0, 60 * MINUTE_MS),
      }),
    );
    expect(de(informeRfef(input(w)), T).acta.digitosFalsos).toBe(1);
  });

  it("an export taken the same day is not the acta: every match stays sin acta", () => {
    const w = competicion(vacio(), T, { n: 2 });
    const r = informeRfef(
      input(w, {
        exportsActa: [
          exportDe(
            "export-mismo-dia.json",
            "2026-11-07T21:00:00.000Z",
            w.actaRows,
          ),
        ],
      }),
    );
    expect(de(r, T).acta.sinActa).toBe(2);
    expect(de(r, T).acta.triples).toBe(0);
    expect(r.avisos[0]).toContain("export-mismo-dia.json");
  });
});

describe("SPEC-039 CA-4 criterio de subida", () => {
  const sano = () => competicion(vacio(), T, { n: 6, deltaS: -5 });

  it("recommends 50 only with the five conditions", () => {
    const c = de(informeRfef(input(sano())), T).criterio;
    expect([
      c.acta.ok,
      c.desfase.ok,
      c.bloqueo.ok,
      c.estrategias.ok,
      c.intervenciones.ok,
    ]).toEqual([true, true, true, true, true]);
    expect(c.recomendacion).toBe("50");
  });

  it("(i) fails under six matches, with a finished different from the acta or without acta", () => {
    expect(
      de(informeRfef(input(competicion(vacio(), T, { n: 5, deltaS: -5 }))), T)
        .criterio.acta.ok,
    ).toBe(false);
    const distinto = competicion(vacio(), T, {
      n: 6,
      deltaS: -5,
      rfefFinal: (i) => (i === 0 ? [0, 0] : [1, 0]),
    });
    expect(de(informeRfef(input(distinto)), T).criterio.acta.ok).toBe(false);
    const sinActa = competicion(vacio(), T, { n: 7, deltaS: -5, acta: false });
    expect(de(informeRfef(input(sinActa)), T).criterio.acta.ok).toBe(false);
  });

  it("(ii) fails with median > 0, with p95 > 45 s or with fewer than 5 goals, and then says «reserva útil»", () => {
    const tarde = de(
      informeRfef(input(competicion(vacio(), T, { n: 6, deltaS: 1 }))),
      T,
    ).criterio;
    expect(tarde.desfase.ok).toBe(false);
    expect(tarde.recomendacion).toBe("5");
    expect(tarde.texto).toMatch(
      /^5 — reserva útil, sin subir \(directo ganado: obs\. 0 p, 0 min; pub\. 0 p, 0 min\)$/,
    );

    const w = sano();
    const o = w.observations.find(
      (x) =>
        x.matchId === `${T}-m5` &&
        x.sourceId === "rfef" &&
        x.status === "live" &&
        x.score?.home === 1,
    );
    if (o?.recordedAt) o.recordedAt = plus(o.recordedAt, 60 * SEC);
    expect(de(informeRfef(input(w)), T).criterio.desfase.ok).toBe(false);

    const pocos = competicion(vacio(), T, { n: 6, deltaS: -5 });
    pocos.observations = pocos.observations.filter(
      (x) =>
        !(
          x.sourceId === "rfef" &&
          x.status === "live" &&
          x.score?.home === 1 &&
          x.matchId >= `${T}-m2`
        ),
    );
    expect(de(informeRfef(input(pocos)), T).criterio.desfase.ok).toBe(false);
  });

  it("(iii) fails with cooldown ≥ 10 % of the competition's window, with an anomaly or without evidence", () => {
    // Six windows of 160 min, no overlap: 960 min; 96 min of cooldown = 10 %.
    const ev = evidenciaLimpia();
    ev.explorer.cooldowns = [
      { inicio: plus(KICKOFF0, 0), fin: plus(KICKOFF0, 96 * MINUTE_MS) },
    ];
    const c = de(informeRfef(input(sano(), { evidencia: ev })), T);
    expect(c.bloqueo.ventanaMs).toBe(960 * MINUTE_MS);
    expect(c.bloqueo.cooldownMs).toBe(96 * MINUTE_MS);
    expect(c.criterio.bloqueo.ok).toBe(false);

    ev.explorer.cooldowns = [
      { inicio: plus(KICKOFF0, 0), fin: plus(KICKOFF0, 95 * MINUTE_MS) },
    ];
    expect(
      de(informeRfef(input(sano(), { evidencia: ev })), T).criterio.bloqueo.ok,
    ).toBe(true);

    const anom = evidenciaLimpia();
    anom.explorer.anomalias = [{ competicion: T, detalle: "digit mismatch" }];
    expect(
      de(informeRfef(input(sano(), { evidencia: anom })), T).criterio.bloqueo
        .ok,
    ).toBe(false);
    expect(
      de(informeRfef(input(sano(), { evidencia: anom })), "segunda-division")
        .bloqueo.anomalias,
    ).toBe(0);

    const nada = de(
      informeRfef(input(sano(), { evidencia: null })),
      T,
    ).criterio;
    expect(nada.bloqueo.ok).toBe(false);
    expect(nada.intervenciones.ok).toBe(false);
    expect(nada.recomendacion).toBe("5");
  });

  it("(iv) fails under 95 % of rows resolved by static strategies", () => {
    const w = competicion(vacio(), T, {
      n: 20,
      deltaS: -5,
      strategy: (i) => (i < 2 ? "playwright:x" : "static:a"),
    });
    expect(de(informeRfef(input(w)), T).criterio.estrategias.ok).toBe(false);
    const w2 = competicion(vacio(), T, {
      n: 20,
      deltaS: -5,
      strategy: (i) => (i < 1 ? "vm:x" : "static:a"),
    });
    expect(de(informeRfef(input(w2)), T).criterio.estrategias.ok).toBe(true);
  });

  it("(v) fails with one manual intervention for that competition or for all", () => {
    const ev = evidenciaLimpia();
    ev.intervenciones = [
      { instante: KICKOFF0, competicion: null, motivo: "alias" },
    ];
    const c = de(informeRfef(input(sano(), { evidencia: ev })), T).criterio;
    expect(c.intervenciones.ok).toBe(false);
    expect(c.recomendacion).toBe("5");
    expect(c.texto).toBe("5");
  });

  it("prints one row per competition in the CA-4 table", () => {
    const r = informeRfef(input(sano()));
    const tabla = r.texto
      .split("\n")
      .filter(
        (l) =>
          l.startsWith("| ") &&
          l.endsWith(" |") &&
          /\| (5|50)( —[^|]*)? \|$/.test(l),
      );
    expect(tabla).toHaveLength(5);
    expect(tabla.find((l) => l.startsWith(`| ${T} `))).toMatch(/\| 50 \|$/);
  });
});

// The competition with no API-Football at all (F-SPEC-039-6): the recipe
// without its rows.
const sinApiFootball = (w: Mundo): Mundo => {
  w.observations = w.observations.filter((o) => o.sourceId !== "api-football");
  return w;
};

describe("SPEC-039 refinamiento H-5: sin datos de API-Football", () => {
  it("CA-1 (b) without API-Football observations in the competition says «sin datos», not n=0", () => {
    const r = informeRfef(
      input(sinApiFootball(competicion(vacio(), T, { n: 2 }))),
    );
    expect(de(r, T).desfase.sinDatos).toBe(true);
    const fila1 = r.texto.split("\n").find((l) => l.startsWith(`| ${T} | 2 |`));
    expect(fila1).toContain("| sin datos |");
    expect(fila1).not.toMatch(/\| 0 \| — \| — \|/);
  });

  it("CA-1 (b) with API-Football observations but no shared goal is n=0, not «sin datos»", () => {
    const w = competicion(vacio(), T, { n: 1 });
    w.observations = w.observations.filter(
      (o) => !(o.sourceId === "rfef" && o.status === "live"),
    );
    const d = de(informeRfef(input(w)), T).desfase;
    expect(d.sinDatos).toBe(false);
    expect(d.n).toBe(0);
  });

  it("CA-2 a match without API-Football finished is «sin api-football»; with none in the competition Triples and ≠ api-football say «sin datos»", () => {
    const w = competicion(vacio(), T, { n: 3 });
    w.observations = w.observations.filter(
      (o) =>
        !(
          o.matchId === `${T}-m0` &&
          o.sourceId === "api-football" &&
          o.status === "finished"
        ),
    );
    const a = de(informeRfef(input(w)), T).acta;
    expect(a.sinApiFootball).toBe(1);
    expect(a.apiFootballSinDatos).toBe(false);
    expect(a.triples).toBe(2);

    const r = informeRfef(
      input(sinApiFootball(competicion(vacio(), T, { n: 3 }))),
    );
    expect(de(r, T).acta).toMatchObject({
      sinApiFootball: 3,
      apiFootballSinDatos: true,
      triples: 0,
      difApiFootball: 0,
    });
    const fila1 = r.texto
      .split("\n")
      .find((l) => l.startsWith(`| ${T} | 3 | sin datos | sin datos |`));
    expect(fila1).toBeDefined();
  });

  it("CA-4 (ii) is «sin datos» when (b) is, and with the others passing the row says «5 — sin referencia de desfase» with the live gained", () => {
    const r = informeRfef(
      input(sinApiFootball(competicion(vacio(), T, { n: 6 }))),
    );
    const c = de(r, T).criterio;
    expect(c.desfase.ok).toBe(false);
    expect(c.desfase.sinDatos).toBe(true);
    expect([
      c.acta.ok,
      c.bloqueo.ok,
      c.estrategias.ok,
      c.intervenciones.ok,
    ]).toEqual([true, true, true, true]);
    expect(c.recomendacion).toBe("5");
    expect(c.texto).toMatch(
      /^5 — sin referencia de desfase \(directo ganado: obs\. \d+ p, \d+ min; pub\. 0 p, 0 min\)$/,
    );
    const fila1 = r.texto.split("\n").find((l) => l.endsWith(`| ${c.texto} |`));
    expect(fila1).toContain("| sin datos |");
  });

  it("CA-4 (ii) «sin datos» with another condition failing is a plain 5", () => {
    const ev = evidenciaLimpia();
    ev.intervenciones = [{ instante: KICKOFF0, competicion: T, motivo: "x" }];
    const c = de(
      informeRfef(
        input(sinApiFootball(competicion(vacio(), T, { n: 6 })), {
          evidencia: ev,
        }),
      ),
      T,
    ).criterio;
    expect(c.texto).toBe("5");
  });
});

describe("SPEC-039 refinamiento H-5: ≠ acta en directo", () => {
  it("CA-2 counts matches with acta whose last rfef live differs from it, with or without a rfef finished, and the minutes since its last change", () => {
    const w = competicion(vacio(), T, { n: 3 });
    // m0: the rfef froze at 0-0 from 1' to 91' and closed 1-0 later.
    w.observations = w.observations.filter(
      (o) =>
        !(
          o.matchId === `${T}-m0` &&
          o.sourceId === "rfef" &&
          o.status === "live" &&
          o.score?.home === 1
        ),
    );
    w.observations.push(
      obs({
        matchId: `${T}-m0`,
        sourceId: "rfef",
        status: "live",
        score: { home: 0, away: 0 },
        receivedAt: plus(KICKOFF0, 91 * MINUTE_MS),
      }),
    );
    const a = de(informeRfef(input(w)), T).acta;
    expect(a.difActaDirecto).toBe(1);
    const p = a.partidos.find((x) => x.matchId === `${T}-m0`);
    expect(p?.rfefLive).toEqual({ home: 0, away: 0 });
    expect(p?.difActaDirecto).toBe(true);
    expect(p?.minutosSinCambio).toBe(90);
    expect(a.partidos.filter((x) => x.difActaDirecto)).toHaveLength(1);
  });

  it("CA-4 (i) fails with one ≠ acta en directo even if every rfef finished matches", () => {
    const w = competicion(vacio(), T, { n: 6, deltaS: -5 });
    w.observations.push(
      obs({
        matchId: `${T}-m2`,
        sourceId: "rfef",
        status: "live",
        score: { home: 0, away: 0 },
        receivedAt: plus(KICKOFF0, (6 * 60 + 100) * MINUTE_MS),
      }),
    );
    const c = de(informeRfef(input(w)), T).criterio;
    expect(c.acta.ok).toBe(false);
    expect(c.acta.detalle).toContain("1 ≠ directo");
  });

  it("CA-4 (i) counts over matches with acta and some rfef observation, finished or not", () => {
    // Six matches with acta whose rfef only saw them live (no finished).
    const w = competicion(vacio(), T, { n: 6, deltaS: -5 });
    w.observations = w.observations.filter(
      (o) => !(o.sourceId === "rfef" && o.status === "finished"),
    );
    const c = de(informeRfef(input(w)), T).criterio;
    expect(c.acta.ok).toBe(true);
    expect(c.acta.detalle).toContain("n=6");
    // Seven matches, one without any rfef observation: still six.
    const w2 = competicion(vacio(), T, { n: 7, deltaS: -5 });
    w2.observations = w2.observations.filter(
      (o) => !(o.matchId === `${T}-m6` && o.sourceId === "rfef"),
    );
    expect(de(informeRfef(input(w2)), T).criterio.acta.detalle).toContain(
      "n=6",
    );
  });
});

// The incident of 2026-11-02 (F-SPEC-039-7): 215 rfef live 0-0 between 20:02Z
// and 21:50Z, no rfef finished, no API-Football (free plan), acta 2-1 and the
// operator closing the Decision 2-1.
describe("SPEC-039 sonda Deportivo–Osasuna 2026-11-02", () => {
  it("gives ≠ acta en directo 1, (i) «no» and coverage 0", () => {
    const P = "primera-division";
    const id = `${P}-depor-osasuna`;
    const kickoff = "2026-11-02T20:00:00.000Z" as Instant;
    const w = vacio();
    const m = suelto(w, P, id, kickoff, null, ["Deportivo", "Osasuna"]);
    m.status = "finished";
    m.score = { home: 2, away: 1 };
    const desde = plus(kickoff, 2 * MINUTE_MS);
    const paso = (108 * MINUTE_MS) / 214;
    for (let k = 0; k < 215; k += 1)
      w.observations.push(
        obs({
          matchId: id,
          sourceId: "rfef",
          status: "live",
          score: { home: 0, away: 0 },
          receivedAt: plus(desde, Math.round(k * paso)),
        }),
      );
    const acta = {
      ...fila(P, 0, "Deportivo", "Osasuna", [2, 1], "FINISHED", "static:a"),
      fechaIso: "2026-11-02",
    };
    const decisions = [
      decision(id, 1, plus(kickoff, -60 * MINUTE_MS), "scheduled", null),
      decision(id, 2, plus(kickoff, 3 * MINUTE_MS), "live", "rfef"),
      decision(id, 3, plus(kickoff, 130 * MINUTE_MS), "finished", "operator"),
    ];
    const r = informeRfef(
      input(w, {
        decisions,
        exportsDelDia: [],
        exportsActa: [
          exportDe(
            "export-2026-11-02-acta.json",
            "2026-11-03T10:00:00.000Z",
            [acta],
            "2026-11-02",
          ),
        ],
      }),
    );
    const c = de(r, P);
    expect(c.obsRfef).toBe(215);
    expect(c.acta.digitosFalsos).toBe(0);
    expect(c.acta.difActaDirecto).toBe(1);
    const p = c.acta.partidos[0];
    expect(p.acta).toEqual({ home: 2, away: 1 });
    expect(p.minutosSinCambio).toBe(108);
    expect(c.criterio.acta.ok).toBe(false);
    expect(c.criterio.desfase.sinDatos).toBe(true);
    expect(c.cobertura.observado).toEqual({ partidos: [], minutos: 0 });
    expect(c.cobertura.publicado).toEqual({ partidos: [], minutos: 0 });
    expect(c.cobertura.aparte).toEqual([
      { matchId: id, motivo: "≠ acta en directo" },
    ]);
    expect(r.texto).toMatch(
      /Deportivo – Osasuna\) \| 2-1 \|.*\| 0-0 \(108 min sin cambio\)/,
    );
  });
});

describe("SPEC-039 CA-5 una página y función pura", () => {
  it("the report fits in 80 lines before the appendix, with the five competitions and every block", () => {
    const w = vacio();
    for (const c of COMPS)
      competicion(w, c, {
        n: 9,
        deltaS: 12,
        strategy: (i) => (i === 0 ? "vm:x" : "static:a"),
      });
    const ev = evidenciaLimpia();
    ev.explorer.anomalias = [{ competicion: null, detalle: "x" }];
    const r = informeRfef(
      input(w, {
        evidencia: ev,
        exportsActa: [
          exportDe(
            "export-mismo-dia.json",
            "2026-11-07T21:00:00.000Z",
            w.actaRows,
          ),
        ],
        attempts: Array.from({ length: 8 }, (_, i) => ({
          sourceId: "rfef",
          startedAt: KICKOFF0,
          ok: false,
          error: `motivo ${i}`,
          fueraDeVentana: 1,
        })),
      }),
    );
    const lines = r.texto.split("\n");
    const corte = lines.indexOf(APENDICE);
    expect(corte).toBeGreaterThan(0);
    expect(corte).toBeLessThanOrEqual(INFORME_RFEF_MAX_LINEAS);
  });

  it("informe-rfef.ts reads no clock, no network and no file", () => {
    const src = readFileSync(
      new URL("./informe-rfef.ts", import.meta.url),
      "utf8",
    );
    for (const banned of [
      "Date.now(",
      "new Date(",
      "fetch(",
      "node:fs",
      "process.",
    ])
      expect(src).not.toContain(banned);
  });
});

describe("SPEC-039 evidencia externa", () => {
  it("parses the evidence file and rejects unknown fields", () => {
    const ok = parseEvidencia(JSON.stringify(evidenciaLimpia()));
    expect(ok.explorer.sesiones).toBe(30);
    expect(() =>
      parseEvidencia(JSON.stringify({ ...evidenciaLimpia(), extra: 1 })),
    ).toThrow(/evidencia/);
    expect(() => parseEvidencia("no")).toThrow(/no es JSON/);
  });
});

// CA-1, the command: the shell is tested like informe:jornada's, in a cwd
// without .env so no real secret reaches the child and no connection opens.
describe("SPEC-039 CA-1 npm run informe:rfef", () => {
  const root = fileURLToPath(new URL("../..", import.meta.url));
  const cleanCwd = mkdtempSync(
    path.join(tmpdir(), "marcadorgal-informe-rfef-"),
  );
  const cleanEnv = { ...process.env };
  for (const key of [
    "DATABASE_URL",
    "API_FOOTBALL_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "INGEST_TICK_TOKEN",
    "RFEF_EXPLORER_TOKEN",
  ])
    delete cleanEnv[key];
  const run = (...args: string[]) =>
    spawnSync(
      process.execPath,
      [path.join(root, "tools", "informe-rfef.mjs"), ...args],
      {
        cwd: cleanCwd,
        env: cleanEnv,
        encoding: "utf8",
      },
    );

  it("without desde and hasta prints the usage and exits 1", () => {
    const r = run();
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("faltan <desde> y <hasta>");
    expect(r.stderr).toContain("npm run informe:rfef -- <desde> <hasta>");
  });

  it("rejects a non ISO-8601 instant", () => {
    expect(run("ayer", "hoy").stderr).toContain(
      "'ayer' no es un instante ISO-8601",
    );
  });

  it("rejects a reversed window", () => {
    expect(run("2026-11-09T22:00Z", "2026-11-06T17:00Z").stderr).toContain(
      "<desde> tiene que ser anterior a <hasta>",
    );
  });

  it("rejects an unknown option and --acta without files", () => {
    expect(
      run("2026-11-06T17:00Z", "2026-11-09T22:00Z", "--todo").stderr,
    ).toContain("opción desconocida: --todo");
    expect(
      run("2026-11-06T17:00Z", "2026-11-09T22:00Z", "--acta").stderr,
    ).toContain("--acta necesita ficheros");
  });

  it("with a well formed window but no DATABASE_URL exits 1 without connecting", () => {
    const r = run("2026-11-06T17:00Z", "2026-11-09T22:00Z");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("DATABASE_URL is not set");
  });
});

import type { TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { AliasFile, type Instant, MINUTE_MS, shiftInstant } from "@/model";
import { createSql } from "../db/connect.ts";
import { apiFootballByIds } from "../sources/api-football/results.ts";
import { contrastarMarcadores } from "./contraste.ts";
import { informeJornada } from "./informe.ts";
import { informeFilas } from "./informe-db.ts";

// SPEC-009 CA-2/CA-3/CA-4/CA-5: the queries of the report against the real
// schema, always rolled back. Nothing is instrumented and nothing is migrated:
// every number comes out of a column that already exists (N-6).

const sql = createSql(process.env);
const ROLLBACK = Symbol("rollback");

// A window nobody else occupies. informeFilas narrows by kickoff and not by
// match id —that is the behaviour under test— and dev carries the declared
// calendar of 2026-27 entire (1.834 matches), so a real matchday date would
// drag real rows into every assertion. The declared season ends on the
// 2027-06-06: July is empty and stays empty.
const KICKOFF = "2027-07-04T16:00:00.000Z" as Instant;
const DESDE = shiftInstant(KICKOFF, -10 * MINUTE_MS);
const HASTA = shiftInstant(KICKOFF, 150 * MINUTE_MS);
const seg = (seconds: number): Instant => shiftInstant(KICKOFF, seconds * 1000);
const CINCO = [
  "primera-division",
  "segunda-division",
  "primera-rfef-g1",
  "segunda-rfef-g1",
  "tercera-rfef-g1",
];

afterAll(() => sql.end());

async function rollback(fn: (tx: TransactionSql) => Promise<void>) {
  await sql
    .begin(async (tx) => {
      await fn(tx);
      throw ROLLBACK;
    })
    .catch((e) => {
      if (e !== ROLLBACK) throw e;
    });
}

async function seedMatch(
  tx: TransactionSql,
  over: { competition?: string; kickoff?: Instant } = {},
): Promise<string> {
  const competition = over.competition ?? "tercera-rfef-g1";
  // The shape the adapter's alias check demands (SPEC-005): a match id that
  // starts with its competition and ends with its two team ids, or parse
  // rejects it as inconsistent_alias and the contrast of CA-5 sees nothing.
  const id = `${competition}-2026-27-t${crypto.randomUUID()}-test-home-test-away`;
  await tx`insert into competitions (id, season, name, tier)
    values (${competition}, '2026-27', ${`Test ${competition}`}, 5)
    on conflict do nothing`;
  await tx`insert into teams (id, name) values ('test-home', 'Home'), ('test-away', 'Away')
    on conflict do nothing`;
  await tx`insert into matches (id, competition_id, season, round, kickoff, home_team_id, away_team_id)
    values (${id}, ${competition}, '2026-27', 4, ${over.kickoff ?? KICKOFF},
      'test-home', 'test-away')`;
  return id;
}

const observe = async (
  tx: TransactionSql,
  matchId: string,
  home: number,
  away: number,
  observedAt: Instant,
  rawRef = "raw/2027-07-04/api-football/x.json.gz",
): Promise<string> => {
  const [row] = await tx<{ id: string }[]>`
    insert into observations (match_id, source_id, status, home_score, away_score,
      minute, observed_at, received_at, raw_ref)
    values (${matchId}, 'api-football', 'live', ${home}, ${away}, 20,
      ${observedAt}, ${observedAt}, ${rawRef})
    returning id`;
  return row.id;
};

const decide = (
  tx: TransactionSql,
  matchId: string,
  home: number,
  away: number,
  decidedAt: Instant,
  observationIds: string[],
) => tx`insert into decisions (match_id, status, home_score, away_score, minute,
      qualifier, rule, observation_ids, decided_at)
    values (${matchId}, 'live', ${home}, ${away}, 20, 'provisional', 'RN-01',
      ${observationIds}, ${decidedAt})`;

const genera = (
  filas: Awaited<ReturnType<typeof informeFilas>>,
  over: Partial<Parameters<typeof informeJornada>[0]> = {},
) =>
  informeJornada({
    desde: DESDE,
    hasta: HASTA,
    secrets: [],
    competicionesDeclaradas: CINCO,
    referencias: [],
    referenciasNoCasadas: [],
    contraste: null,
    ...filas,
    ...over,
  });

describe("CA-2 cadencia y latencia interna contra la base de datos", () => {
  it(
    "tres observaciones a 30, 30 y 120 s y dos Decisions: los huecos, el hueco largo y la latencia",
    () =>
      rollback(async (tx) => {
        const matchId = await seedMatch(tx);
        const o1 = await observe(tx, matchId, 0, 0, seg(0));
        const o2 = await observe(tx, matchId, 0, 0, seg(30));
        const o3 = await observe(tx, matchId, 1, 0, seg(60));
        await observe(tx, matchId, 1, 0, seg(180));
        // La v1 estrena el 0-0; la v2 sube el marcador citando o3.
        await decide(tx, matchId, 0, 0, seg(2), [o1]);
        await decide(tx, matchId, 1, 0, seg(64), [o3]);
        expect(o2).not.toBe(o1);

        const filas = await informeFilas(tx, DESDE, HASTA);
        expect(filas.matches).toHaveLength(1);
        expect(filas.observations).toHaveLength(4);
        expect(filas.decisions).toHaveLength(2);

        const { texto, informe } = genera(filas);
        // Huecos de 30, 30 y 120 s entre observaciones, más el silencio final:
        // el partido se queda en `live`, así que su ventana efectiva llega a
        // kickoff + 150 min y desde seg(180) no vuelve a observarse (V-2).
        const FINAL = 150 * MINUTE_MS - 180_000;
        expect(informe.cadencia).toMatchObject({
          n: 4,
          mediana: 30_000,
          maximo: FINAL,
        });
        const [{ name }] = await tx<{ name: string }[]>`select name from
          competitions where id = 'tercera-rfef-g1' and season = '2026-27'`;
        expect(informe.cadencia.huecosLargos).toEqual([
          { matchId, competicion: name, desde: seg(60), ms: 120_000 },
          {
            matchId,
            competicion: name,
            desde: seg(180),
            ms: FINAL,
            final: true,
          },
        ]);
        expect(texto).toContain("huecos > 90 s: 2");
        expect(texto).toContain("hasta el cierre de su ventana");

        // La Decision que sube el marcador: 64 s − 60 s de su observación.
        expect(informe.latenciaInterna).toMatchObject({ n: 2, maximo: 4_000 });
        expect(informe.techoPropio).toBe(FINAL + 4_000);
        expect(texto).toContain("captura → publicación");
      }),
    20_000,
  );
});

describe("CA-4 partidos sin señal y alertas contra la base de datos", () => {
  it("un partido sin observaciones y dos alertas de distinto kind salen en sus bloques", () =>
    rollback(async (tx) => {
      const conSenal = await seedMatch(tx);
      const mudo = await seedMatch(tx, { competition: "segunda-rfef-g1" });
      await observe(tx, conSenal, 0, 0, seg(0));
      await observe(tx, conSenal, 1, 0, seg(30));
      await tx`insert into alerts (kind, match_id, opened_at, details)
        values ('silence', ${conSenal}, ${seg(60)}, ${tx.json({ minutes: 16 })}),
               ('forced_finish', ${mudo}, ${seg(120)}, ${tx.json({ minute: 90 })})`;

      const { texto, informe } = genera(await informeFilas(tx, DESDE, HASTA));
      const [{ name }] = await tx<{ name: string }[]>`select name from
        competitions where id = 'segunda-rfef-g1' and season = '2026-27'`;
      expect(informe.sinSenal.sinObservaciones).toEqual([
        { matchId: mudo, competicion: name },
      ]);
      expect(informe.alertas.porKind).toEqual([
        { kind: "forced_finish", count: 1 },
        { kind: "silence", count: 1 },
      ]);
      expect(informe.alertas.inesperadas).toBe(0);
      expect(texto).toContain("sin ninguna observación: 1");
      expect(texto).toContain('{"minutes":16}');
      expect(texto).toContain("explicación:");
    }));

  it("las peticiones salen de details->>'requests', no de net._http_response", () =>
    rollback(async (tx) => {
      await seedMatch(tx);
      await tx`insert into ingest_attempts (source_id, started_at, finished_at, ok, observations, details)
        values ('api-football', ${seg(0)}, ${seg(1)}, true, 9, ${tx.json({ requests: 2 })}),
               ('api-football', ${seg(30)}, ${seg(31)}, true, 9, ${tx.json({ requests: 3 })}),
               ('api-football', ${seg(60)}, ${seg(61)}, false, 0, ${tx.json({})})`;

      const { informe } = genera(await informeFilas(tx, DESDE, HASTA));
      expect(informe.peticiones.total).toBe(5);
      expect(informe.peticiones.intentos).toBe(3);
      expect(informe.cobertura.intentosFallidos).toBe(1);
    }));
});

describe("CA-3 el cruce del CSV contra la base de datos", () => {
  it("de tres filas casa una y las otras dos quedan listadas con su motivo", () =>
    rollback(async (tx) => {
      const matchId = await seedMatch(tx);
      const o1 = await observe(tx, matchId, 1, 0, seg(30));
      await decide(tx, matchId, 1, 0, seg(45), [o1]);

      const { texto, informe } = genera(await informeFilas(tx, DESDE, HASTA), {
        referencias: [
          { matchId, marcador: "1-0", instante: seg(20), fuente: "radio" },
          { matchId, marcador: "3-3", instante: seg(25), fuente: "radio" },
          {
            matchId: "no-existe",
            marcador: "1-0",
            instante: seg(30),
            fuente: "TV",
          },
        ],
        referenciasNoCasadas: [],
      });
      // 45 s − 20 s de la referencia externa.
      expect(informe.latenciaExterna).toMatchObject({ n: 1, mediana: 25_000 });
      expect(informe.latenciaExterna.noCasadas).toEqual([
        {
          fila: `${matchId},3-3,${seg(25)},radio`,
          motivo: "el marcador 3-3 nunca se publicó",
        },
        {
          fila: `no-existe,1-0,${seg(30)},TV`,
          motivo: "no-existe no es un partido de la ventana",
        },
      ]);
      expect(texto).toContain("referencias no casadas: 2");
      expect(texto).toContain("peor caso (n=1)");
    }));
});

describe("CA-5 el contraste con el proveedor", () => {
  // The provider's body, as api-football answers ids=; 439 is the league id
  // of tercera-rfef-g1 (LEAGUES), which is the competition the matches are in.
  const fixture = (id: string, home: number, away: number) => ({
    fixture: { id, status: { short: "FT", elapsed: 90 } },
    league: { id: 439 },
    teams: { home: { id: 1, name: "Home" }, away: { id: 2, name: "Away" } },
    goals: { home, away },
  });

  it("dos partidos en board, uno coincidente y uno no: la tabla lista uno y la discrepancia el otro", () =>
    rollback(async (tx) => {
      const coincide = await seedMatch(tx);
      const discrepa = await seedMatch(tx);
      // Both finished 2-1 for us; the provider says 2-2 for the second.
      for (const [matchId, home, away] of [
        [coincide, 2, 1],
        [discrepa, 2, 1],
      ] as const) {
        const o = await observe(
          tx,
          matchId,
          home,
          away,
          seg(30),
          "raw/viejo.gz",
        );
        await observe(tx, matchId, home, away, seg(60), "raw/ultimo.gz");
        await tx`insert into decisions (match_id, status, home_score, away_score,
            minute, qualifier, rule, observation_ids, decided_at)
          values (${matchId}, 'finished', ${home}, ${away}, null, 'provisional',
            'RN-01', ${[o]}, ${seg(90)})`;
      }

      const filas = await informeFilas(tx, DESDE, HASTA);
      expect(filas.matches.map((m) => m.status)).toEqual([
        "finished",
        "finished",
      ]);

      // A fetch double: no request leaves here, and it records what was asked.
      const urls: string[] = [];
      const doble: typeof globalThis.fetch = async (url) => {
        urls.push(String(url));
        return new Response(
          JSON.stringify({
            response: [fixture("101", 2, 1), fixture("102", 2, 2)],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      };

      const aliases = AliasFile.parse({
        source: "api-football",
        season: "2026-27",
        teams: [
          { externalId: "1", externalName: "Home", teamId: "test-home" },
          { externalId: "2", externalName: "Away", teamId: "test-away" },
        ],
        matches: { "101": coincide, "102": discrepa },
      });
      const { createApiFootballResults } = await import(
        "../sources/api-football/results.ts"
      );
      const adapter = createApiFootballResults({
        aliases,
        apiKey: "clave-de-prueba",
      });
      const salida = await contrastarMarcadores({
        matches: filas.matches,
        aliases,
        adapter,
        capturar: (fixtureIds) =>
          apiFootballByIds({
            fixtureIds,
            apiKey: "clave-de-prueba",
            userAgent: "test",
            now: seg(200),
            fetch: doble,
          }),
      });
      // One request for two ids (≤ 20 per request, SPEC-005).
      expect(urls).toEqual([
        "https://v3.football.api-sports.io/fixtures?ids=101-102",
      ]);
      expect(salida.peticiones).toBe(1);
      expect(salida.sinAlias).toEqual([]);

      const { texto, informe } = genera(filas, {
        contraste: salida.filas,
        contrastePeticiones: salida.peticiones,
      });
      expect(informe.contraste).toMatchObject({ total: 2, coinciden: 1 });
      expect(informe.contraste?.discrepancias).toEqual([
        {
          matchId: discrepa,
          board: { status: "finished", marcador: "2-1" },
          proveedor: { status: "finished", marcador: "2-2" },
          rawRef: "raw/ultimo.gz",
        },
      ]);
      expect(texto).toContain(
        "1 de 2 partidos con `finished` y marcador coincidente",
      );
      expect(texto).toContain("raw/ultimo.gz");
      expect(texto).toContain("peticiones del contraste: 1");
    }));
});

import { gunzipSync } from "node:zlib";
import type { Sql, TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { createSql } from "../db/connect.ts";
import type {
  DayMatchesResponse,
  ExplorerRawResponse,
} from "../lib/explorer-client.ts";
import { windowDaysOf } from "../lib/explorer-window.ts";
import type { Instant } from "../model/index.ts";
import { createMemoryRawStore, type MemoryRawStore } from "../raw/memory.ts";
import { SOURCES } from "../sources/registry.ts";
import { createIngestDb } from "./db.ts";
import { formatHistoricoReport, historicoFailed } from "./historico.ts";
import { historicoSync } from "./historico-db.ts";

// SPEC-060 CA-2..CA-5 (ADR-034) against the real schema, always rolled back.
// The dates are of July 2026, before the season, so no declared match of the
// calendar shares them with the seeded ones.
const sql = createSql(process.env);
const ROLLBACK = Symbol("rollback");

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

// Inside a transaction sql.begin has to become a savepoint (db.db.test.ts).
const dbIn = (tx: TransactionSql) =>
  createIngestDb(
    Object.assign(tx, { begin: tx.savepoint.bind(tx) }) as unknown as Sql,
  );

afterAll(() => sql.end({ timeout: 5 }));

const DAY1 = "2026-07-01";
const DAY2 = "2026-07-02";
const CELTA = "spec060-j1-spec060celta-spec060osasuna";
const DEPOR = "spec060-j1-spec060depor-spec060lugo";
const BETIS = "spec060-j2-spec060betis-spec060girona";

async function seed(tx: TransactionSql) {
  await tx`insert into competitions (id, season, name, tier)
    values ('spec060', '2026-27', 'SPEC-060', 1) on conflict do nothing`;
  await tx`insert into teams (id, name) values
    ('spec060celta', 'Celta SPEC'), ('spec060osasuna', 'Osasuna SPEC'),
    ('spec060depor', 'Depor SPEC'), ('spec060lugo', 'Lugo SPEC'),
    ('spec060betis', 'Betis SPEC'), ('spec060girona', 'Girona SPEC')
    on conflict do nothing`;
  await tx`insert into matches (id, competition_id, season, round, kickoff, home_team_id, away_team_id) values
    (${CELTA}, 'spec060', '2026-27', 1, '2026-07-01T17:00:00Z', 'spec060celta', 'spec060osasuna'),
    (${DEPOR}, 'spec060', '2026-27', 1, '2026-07-01T19:00:00Z', 'spec060depor', 'spec060lugo'),
    (${BETIS}, 'spec060', '2026-27', 2, '2026-07-02T19:00:00Z', 'spec060betis', 'spec060girona')`;
}

// A Decision v1 finished h-a of api-football, as the engine of then left it.
async function closed(
  tx: TransactionSql,
  matchId: string,
  h: number,
  a: number,
) {
  const [{ id }] = await tx<{ id: string }[]>`insert into observations
    (match_id, source_id, status, home_score, away_score, observed_at, received_at, raw_ref)
    values (${matchId}, 'api-football', 'finished', ${h}, ${a}, '2026-07-01T19:00:00Z',
      '2026-07-01T19:00:00Z', 'raw/api-football/2026-07-01/x.json.gz')
    returning id`;
  await tx`insert into decisions
    (match_id, status, home_score, away_score, qualifier, rule, observation_ids, decided_at, forced_finish)
    values (${matchId}, 'finished', ${h}, ${a}, 'provisional', 'RN-01', ${[id]},
      '2026-07-01T19:00:00Z', false)`;
}

type ExplorerMatch = DayMatchesResponse["matches"][number];
const em = (
  home: string,
  away: string,
  rest: Partial<ExplorerMatch>,
): ExplorerMatch => ({
  canonicalCompetitionId: "spec060",
  canonicalHomeTeamId: home,
  canonicalAwayTeamId: away,
  estado: "FINISHED",
  ...rest,
});

const CELTA_2_1 = em("spec060celta", "spec060osasuna", {
  homeScore: 2,
  awayScore: 1,
  goals: [
    { team: "home", player: "Aspas", minute: 23 },
    { team: "away", player: "Budimir", minute: 60, penalty: true },
    { team: "home", player: "Swedberg", minute: 85 },
  ],
});

// Explorer by date: a status and a body per date, every call recorded.
function explorer(
  byDate: Record<
    string,
    { status?: number; matches?: ExplorerMatch[]; body?: string }
  >,
) {
  const calls: string[] = [];
  const fetchDay = async (date: string): Promise<ExplorerRawResponse> => {
    calls.push(date);
    const r = byDate[date] ?? { matches: [] };
    return {
      url: `https://explorer.test/api/export/matches?date=${date}`,
      status: r.status ?? 200,
      contentType: "application/json",
      body:
        r.body ??
        JSON.stringify({
          date,
          exportedAt: `${date}T23:00:00Z`,
          matches: r.matches ?? [],
        }),
    };
  };
  return { calls, fetchDay };
}

let tick = 0;
const clock = (): Instant => {
  tick += 1;
  return new Date(
    Date.parse("2026-11-09T10:00:00.000Z") + tick * 60_000,
  ).toISOString() as Instant;
};

const run = (
  tx: TransactionSql,
  fetchDay: (date: string) => Promise<ExplorerRawResponse>,
  store: MemoryRawStore | null,
  desde: string,
  hasta: string,
  dryRun = false,
) =>
  historicoSync({
    sql: tx,
    db: dbIn(tx),
    store,
    fetchDay,
    clock,
    sources: SOURCES,
    args: { desde, hasta, dryRun },
  });

async function counts(tx: TransactionSql) {
  const [row] = await tx<Record<string, number>[]>`select
    (select count(*)::int from observations) as observations,
    (select count(*)::int from decisions) as decisions,
    (select count(*)::int from match_goals) as match_goals,
    (select count(*)::int from alerts) as alerts,
    (select count(*)::int from ingest_attempts) as ingest_attempts,
    (select count(*)::int from social_posts) as social_posts,
    (select count(*)::int from matches) as matches`;
  return row;
}

describe("SPEC-060 CA-2 the operator corrects the close through the engine", () => {
  it("finished 1-1 + Explorer FINISHED 2-1 → v2 finished 2-1 operator confirmado; again, 0 rows", () =>
    rollback(async (tx) => {
      await seed(tx);
      await closed(tx, CELTA, 1, 1);
      const store = createMemoryRawStore();
      const { fetchDay } = explorer({ [DAY1]: { matches: [CELTA_2_1] } });
      const { alerts: alertsBefore, social_posts: socialBefore } =
        await counts(tx);

      const report = await run(tx, fetchDay, store, DAY1, DAY1);
      expect(report.failed).toEqual([]);

      const decisions = await tx`select version, status, home_score, away_score,
          qualifier, rule, observation_ids, decided_at
        from decisions where match_id = ${CELTA} order by version`;
      expect(decisions).toHaveLength(2);
      expect(decisions[1]).toMatchObject({
        version: 2,
        status: "finished",
        home_score: 2,
        away_score: 1,
        qualifier: "confirmado",
        rule: "operator",
      });

      const [obs] =
        await tx`select id, source_id, status, home_score, away_score,
          observed_at, raw_ref from observations
        where match_id = ${CELTA} and source_id = 'operator'`;
      expect(obs).toMatchObject({
        status: "finished",
        home_score: 2,
        away_score: 1,
      });
      expect(decisions[1].observation_ids).toEqual([obs.id]);
      // The instant of the reading, not the kickoff (V-3), and the engine ran at it.
      expect(obs.observed_at.toISOString()).not.toBe(
        "2026-07-01T17:00:00.000Z",
      );
      expect(decisions[1].decided_at.toISOString()).toBe(
        obs.observed_at.toISOString(),
      );

      // raw_ref points at the stored raw of that reading, readable (ADR-007).
      expect(obs.raw_ref).toMatch(/^raw\/operator\//);
      const body = await store.get(obs.raw_ref.slice("raw/".length));
      expect(body).not.toBeNull();
      const capture = JSON.parse(
        gunzipSync(body as Uint8Array).toString("utf8"),
      );
      expect(capture.sourceId).toBe("operator");
      // The seven days of the window of DAY1 (SPEC-071), DAY1 among them.
      expect(capture.requests).toHaveLength(7);
      const own = capture.requests.find((r: { url: string }) =>
        r.url.endsWith(`date=${DAY1}`),
      );
      expect(JSON.parse(own.body).matches[0].homeScore).toBe(2);

      // One attempt of the operator, closed ok with the raw and one observation.
      const attempts = await tx`select ok, error, raw_ref, observations, details
        from ingest_attempts where source_id = 'operator' and details->>'fecha' = ${DAY1}`;
      expect(attempts).toEqual([
        expect.objectContaining({
          ok: true,
          error: null,
          raw_ref: obs.raw_ref,
          observations: 1,
        }),
      ]);

      expect((await counts(tx)).alerts).toBe(alertsBefore);
      // The engine of the recovery queues nothing for the social networks
      // (ADR-030 §1): a goal of last month is not published today.
      expect((await counts(tx)).social_posts).toBe(socialBefore);

      // Goals complete (2 + 1): stored.
      const goals = await tx`select team, player, minute, penalty, own_goal
        from match_goals where match_id = ${CELTA} order by minute`;
      expect(goals).toEqual([
        {
          team: "home",
          player: "Aspas",
          minute: 23,
          penalty: false,
          own_goal: false,
        },
        {
          team: "away",
          player: "Budimir",
          minute: 60,
          penalty: true,
          own_goal: false,
        },
        {
          team: "home",
          player: "Swedberg",
          minute: 85,
          penalty: false,
          own_goal: false,
        },
      ]);

      // A second identical run writes 0 rows (only its attempt, ADR-034 §4).
      const before = await counts(tx);
      const again = await run(tx, fetchDay, store, DAY1, DAY1);
      expect(again.failed).toEqual([]);
      const after = await counts(tx);
      expect(after).toEqual({
        ...before,
        ingest_attempts: before.ingest_attempts + 1,
      });
      expect(formatHistoricoReport(again)[0]).toBe("Sin cambios.");
    }));

  it("a match with no Decision gets v1 operator confirmado", () =>
    rollback(async (tx) => {
      await seed(tx);
      const { fetchDay } = explorer({ [DAY1]: { matches: [CELTA_2_1] } });
      await run(tx, fetchDay, createMemoryRawStore(), DAY1, DAY1);
      const rows =
        await tx`select version, status, rule from decisions where match_id = ${CELTA}`;
      expect(rows).toEqual([
        { version: 1, status: "finished", rule: "operator" },
      ]);
    }));
});

describe("SPEC-060 CA-3 goals only when FINISHED and complete", () => {
  it("LIVE_PROVISIONAL with goals: [] and FINISHED 1-0 without goals keep the stored goals", () =>
    rollback(async (tx) => {
      await seed(tx);
      await closed(tx, CELTA, 1, 0);
      await closed(tx, DEPOR, 0, 0);
      await tx`insert into match_goals (match_id, team, player, minute) values
        (${CELTA}, 'home', 'Aspas', 10), (${DEPOR}, 'home', 'Lucas', 30)`;
      const { fetchDay } = explorer({
        [DAY1]: {
          matches: [
            em("spec060celta", "spec060osasuna", {
              estado: "LIVE_PROVISIONAL",
              homeScore: 0,
              awayScore: 0,
              goals: [],
            }),
            em("spec060depor", "spec060lugo", {
              homeScore: 1,
              awayScore: 0,
              goals: [],
            }),
          ],
        },
      });
      const report = await run(
        tx,
        fetchDay,
        createMemoryRawStore(),
        DAY1,
        DAY1,
      );

      const goals = await tx`select match_id, player from match_goals
        where match_id in (${CELTA}, ${DEPOR}) order by match_id`;
      expect(goals).toEqual([
        { match_id: CELTA, player: "Aspas" },
        { match_id: DEPOR, player: "Lucas" },
      ]);
      // Celta is not touched at all; Depor gets its score corrected.
      const [celta] =
        await tx`select max(version)::int as v from decisions where match_id = ${CELTA}`;
      expect(celta.v).toBe(1);
      const [depor] =
        await tx`select status, home_score, away_score, rule from decisions
        where match_id = ${DEPOR} order by version desc limit 1`;
      expect(depor).toEqual({
        status: "finished",
        home_score: 1,
        away_score: 0,
        rule: "operator",
      });

      const lines = formatHistoricoReport(report);
      expect(lines[lines.indexOf("Goles incompletos (1):") + 1]).toContain(
        "Depor SPEC–Lugo SPEC",
      );
      expect(
        lines[lines.indexOf("Sin FINISHED en Explorer (1):") + 1],
      ).toContain("LIVE_PROVISIONAL");
    }));
});

describe("SPEC-060 CA-4 --dry-run writes nothing", () => {
  it("0 rows in every table, nothing in the raw store, and the plan printed", () =>
    rollback(async (tx) => {
      await seed(tx);
      await closed(tx, CELTA, 1, 1);
      const store = createMemoryRawStore();
      const before = await counts(tx);
      const { fetchDay, calls } = explorer({
        [DAY1]: { matches: [CELTA_2_1] },
      });
      const report = await run(tx, fetchDay, store, DAY1, DAY1, true);
      expect(calls).toEqual(windowDaysOf(DAY1));
      expect(await counts(tx)).toEqual(before);
      expect(store.objects.size).toBe(0);
      const lines = formatHistoricoReport(report);
      expect(lines[0]).toBe(
        "2026-07-01 · spec060 · J1 · Celta SPEC–Osasuna SPEC · finished 1-1 → 2-1 · goles 0 → 3",
      );
      expect(lines).toContain("  spec060 J1: 1 marcadores · 1 goleadores");
      expect(lines[lines.indexOf("Sin FINISHED en Explorer (0):") + 2]).toBe(
        "Sin emparejar (1):",
      );
    }));
});

describe("SPEC-060 CA-5 failures are visible", () => {
  it("a 401 aborts in the act: attempt ok = false, no later date asked, report failed", () =>
    rollback(async (tx) => {
      await seed(tx);
      const before = await counts(tx);
      const { fetchDay, calls } = explorer({
        [DAY1]: { status: 401, body: "Unauthorized" },
        [DAY2]: { matches: [] },
      });
      const report = await run(
        tx,
        fetchDay,
        createMemoryRawStore(),
        DAY1,
        DAY2,
      );
      // The window stops at the 401: DAY1 − 3 .. DAY1, and no DAY2.
      expect(calls).toEqual(windowDaysOf(DAY1).slice(0, 4));
      expect(report.aborted).toBe(
        `${DAY1}: [explorer] respuesta 401 (${DAY1})`,
      );
      expect(report.failed).toEqual([
        { date: DAY1, error: `[explorer] respuesta 401 (${DAY1})` },
      ]);
      expect(historicoFailed(report)).toBe(true);
      const after = await counts(tx);
      expect(after).toEqual({
        ...before,
        ingest_attempts: before.ingest_attempts + 1,
      });
      const [attempt] = await tx`select ok, error, raw_ref from ingest_attempts
        where source_id = 'operator' and details->>'fecha' = ${DAY1}`;
      expect(attempt).toMatchObject({
        ok: false,
        error: `[explorer] respuesta 401 (${DAY1})`,
      });
      expect(attempt.raw_ref).toMatch(/^raw\/operator\//);
    }));

  it("an empty date fails, writes nothing, and the next date still runs", () =>
    rollback(async (tx) => {
      await seed(tx);
      const { fetchDay, calls } = explorer({
        [DAY1]: { matches: [] },
        [DAY2]: {
          matches: [
            em("spec060betis", "spec060girona", {
              homeScore: 1,
              awayScore: 1,
              goals: [
                { team: "home", player: "Isco", minute: 5 },
                { team: "away", player: "Stuani", minute: 50 },
              ],
            }),
          ],
        },
      });
      const report = await run(
        tx,
        fetchDay,
        createMemoryRawStore(),
        DAY1,
        DAY2,
      );
      // Each day once, though the windows of DAY1 and DAY2 overlap.
      expect(calls).toEqual([...windowDaysOf(DAY1), "2026-07-05"]);
      expect(report.aborted).toBeNull();
      expect(report.failed).toEqual([
        {
          date: DAY1,
          error: "[explorer] 0 partidos para 2026-07-01 con 2 declarados",
        },
      ]);
      expect(historicoFailed(report)).toBe(true);
      const lines = formatHistoricoReport(report);
      expect(lines[lines.indexOf("Fechas fallidas (1):") + 1]).toBe(
        "  2026-07-01 · [explorer] 0 partidos para 2026-07-01 con 2 declarados",
      );
      const attempts =
        await tx`select details->>'fecha' as fecha, ok from ingest_attempts
        where source_id = 'operator' order by details->>'fecha'`;
      expect(attempts).toEqual([
        { fecha: DAY1, ok: false },
        { fecha: DAY2, ok: true },
      ]);
      const rows = await tx`select match_id from observations
        where source_id = 'operator' and match_id in (${CELTA}, ${DEPOR}, ${BETIS})`;
      expect(rows).toEqual([{ match_id: BETIS }]);
    }));

  it("an invalid answer (a proxy page) fails its date and writes nothing", () =>
    rollback(async (tx) => {
      await seed(tx);
      const { fetchDay } = explorer({ [DAY1]: { body: "<html>proxy</html>" } });
      const report = await run(
        tx,
        fetchDay,
        createMemoryRawStore(),
        DAY1,
        DAY1,
      );
      expect(report.failed).toEqual([
        { date: DAY1, error: "[explorer] respuesta inválida: no es JSON" },
      ]);
      const rows = await tx`select count(*)::int as n from observations
        where match_id in (${CELTA}, ${DEPOR})`;
      expect(rows[0].n).toBe(0);
    }));
});

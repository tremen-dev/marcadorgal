import { readFileSync } from "node:fs";
import type { Sql, TransactionSql } from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { type Instant, MINUTE_MS, shiftInstant } from "@/model";
import { createSql } from "../db/connect.ts";
import { createMemoryRawStore } from "../raw/memory.ts";
import { SOURCES, sourceConfig } from "../sources/registry.ts";
import { adapterFor } from "./adapters.ts";
import { loadDeclaredCalendar } from "./calendar.ts";
import { createIngestDb } from "./db.ts";
import { recoveryCounts, recuperarRfef } from "./recuperacion-rfef-db.ts";

// SPEC-044 CA-6 and CA-7 (ADR-025 §6) against the real schema, always
// rolled back, with a fetch double that serves the real exports of
// fixtures/export/ by ?date=. Five declared matches of the matchday
// 2026-10-30/11-02 are seeded: four scheduled without a Decision (one of
// them the real POSTPONED, Tenerife–Andorra) and one the source closed
// (finished without the mark) with a score that disagrees with the export.
const sql = createSql(process.env);
const ROLLBACK = Symbol("rollback");

const root = new URL("../../", import.meta.url);
const EXPORT_DIR = "src/sources/rfef/fixtures/export";
const EXPLORER_URL = "https://explorer.test";
const ENV = {
  API_FOOTBALL_KEY: "not-a-real-key",
  RFEF_EXPLORER_URL: EXPLORER_URL,
  RFEF_EXPLORER_TOKEN: "tok-s3cret",
};
const NOW = "2026-11-02T11:00:00.000Z" as Instant;
const DESDE = "2026-10-30";
const HASTA = "2026-11-02";

const SEEDED = [
  "primera-division-2026-27-j11-barcelona-alaves",
  "primera-division-2026-27-j11-levante-atletico-madrid",
  "primera-rfef-g1-2026-27-j10-zamora-deportivo-fabril",
  "segunda-division-2026-27-j12-tenerife-andorra",
  "tercera-rfef-g1-2026-27-j9-silva-viveiro",
];
const CLOSED = "primera-division-2026-27-j11-levante-atletico-madrid";
const POSTPONED = "segunda-division-2026-27-j12-tenerife-andorra";

const calendar = loadDeclaredCalendar("2026-27");

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

async function seedMatchday(tx: TransactionSql) {
  const tiers: Record<string, number> = {
    "primera-division": 1,
    "segunda-division": 2,
    "primera-rfef-g1": 3,
    "segunda-rfef-g1": 4,
    "tercera-rfef-g1": 5,
  };
  for (const id of SEEDED) {
    const m = calendar.find((c) => c.id === id);
    if (m === undefined) throw new Error(`${id} is not in the calendar`);
    await tx`insert into competitions (id, season, name, tier)
      values (${m.competitionId}, '2026-27', ${m.competitionId}, ${tiers[m.competitionId]})
      on conflict do nothing`;
    await tx`insert into teams (id, name)
      values (${m.homeTeamId}, ${m.homeTeamId}), (${m.awayTeamId}, ${m.awayTeamId})
      on conflict do nothing`;
    await tx`insert into matches (id, competition_id, season, round, kickoff, home_team_id, away_team_id)
      values (${id}, ${m.competitionId}, '2026-27', ${m.round}, ${m.kickoff}, ${m.homeTeamId}, ${m.awayTeamId})`;
  }
  // The closed one: api-football gave 9-9 (wrong on purpose) and the engine
  // published it finished provisional, no forced finish.
  const [{ id: oid }] = await tx<{ id: string }[]>`insert into observations
    (match_id, source_id, status, home_score, away_score, observed_at, received_at, raw_ref)
    values (${CLOSED}, 'api-football', 'finished', 9, 9, '2026-10-31T15:00:00Z',
      '2026-10-31T15:00:00Z', 'raw/api-football/2026-10-31/x.json.gz')
    returning id`;
  await tx`insert into decisions
    (match_id, status, home_score, away_score, qualifier, rule, observation_ids,
      decided_at, forced_finish)
    values (${CLOSED}, 'finished', 9, 9, 'provisional', 'RN-01', ${[oid]},
      '2026-10-31T15:00:00Z', false)`;
}

// explorer by ?date=, out of the real fixtures; lastSeenAt may be shifted
// to simulate explorer rereading the rows (CA-7).
function explorerDouble(shiftSeconds = 0) {
  const urls: string[] = [];
  const fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    urls.push(url);
    const date = url.slice(-10);
    let body = readFileSync(
      new URL(`${EXPORT_DIR}/export-${date}.json`, root),
      "utf8",
    );
    if (shiftSeconds !== 0) {
      const parsed = JSON.parse(body) as {
        matches: { lastSeenAt: string }[];
      };
      for (const row of parsed.matches)
        row.lastSeenAt = shiftInstant(
          row.lastSeenAt as Instant,
          shiftSeconds * 1000,
        );
      body = JSON.stringify(parsed);
    }
    return new Response(body, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof globalThis.fetch;
  return { urls, fetch };
}

const config = sourceConfig("rfef");
if (config === undefined) throw new Error("rfef is not registered");

const run = (
  tx: TransactionSql,
  fetch: typeof globalThis.fetch,
  dryRun: boolean,
  over: Partial<Parameters<typeof recuperarRfef>[0]> = {},
) =>
  recuperarRfef({
    sql: tx,
    db: dbIn(tx),
    store: createMemoryRawStore(),
    adapterFor: (c, season) => adapterFor(c, season, ENV),
    config,
    sources: SOURCES,
    fetch,
    clock: () => NOW,
    desde: DESDE,
    hasta: HASTA,
    dryRun,
    sleep: async () => {},
    ...over,
  });

const boardOf = (tx: TransactionSql) =>
  tx<
    {
      match_id: string;
      status: string;
      home_score: number | null;
      away_score: number | null;
      qualifier: string;
    }[]
  >`
    select match_id, status, home_score, away_score, qualifier from board
    where match_id = any(${tx.array(SEEDED)}) order by match_id`;

const attempts = (tx: TransactionSql) =>
  tx<
    { details: Record<string, unknown>; ok: boolean; raw_ref: string | null }[]
  >`
    select details, ok, raw_ref from ingest_attempts
    where source_id = 'rfef' and started_at = ${NOW} order by id`;

// SPEC-035 CA-5 (ADR-019 §4): consecutive versions of a match with the same
// published tuple. With the lock of §1 in place they are always 0.
const twins = (tx: TransactionSql) =>
  tx<{ n: number }[]>`
    with v as (
      select match_id, version, status, home_score, away_score, minute,
        added_minute, half_time, qualifier,
        lag(status) over w as p_status, lag(home_score) over w as p_home,
        lag(away_score) over w as p_away, lag(minute) over w as p_minute,
        lag(added_minute) over w as p_added, lag(half_time) over w as p_ht,
        lag(qualifier) over w as p_qualifier, lag(version) over w as p_version
      from decisions where match_id = any(${tx.array(SEEDED)})
      window w as (partition by match_id order by version)
    )
    select count(*)::int as n from v
    where p_version = version - 1
      and status = p_status and home_score is not distinct from p_home
      and away_score is not distinct from p_away
      and minute is not distinct from p_minute
      and added_minute is not distinct from p_added
      and half_time = p_ht and qualifier = p_qualifier`;

afterAll(() => sql.end());

describe("SPEC-044 CA-6 rfef:recuperar through the database", () => {
  it("--dry-run: two GET to explorer, the raw kept, one attempt with dryRun, and no other row", () =>
    rollback(async (tx) => {
      await seedMatchday(tx);
      const before = await recoveryCounts(tx);
      const { urls, fetch } = explorerDouble();
      const store = createMemoryRawStore();
      const result = await run(tx, fetch, true, { store });
      expect(result.outcome).toBe("en-seco");
      if (result.outcome !== "en-seco") return;
      // One GET per date with matches, all of them to explorer.
      expect(urls).toEqual([
        `${EXPLORER_URL}/api/export/matches?date=2026-10-31`,
        `${EXPLORER_URL}/api/export/matches?date=2026-11-01`,
      ]);
      expect(store.objects.size).toBe(1);
      expect(result.rawRef).toMatch(/^raw\/rfef\/2026-11-02\//);
      // The plan says what it would do, and did none of it.
      expect(result.plan.insert).toHaveLength(5);
      expect(result.plan.groups.flatMap((g) => g.matchIds).sort()).toEqual(
        SEEDED.filter((id) => id !== CLOSED).sort(),
      );
      expect(result.plan.closed).toEqual([
        { matchId: CLOSED, agrees: false, alert: expect.any(Object) },
      ]);
      expect(result.lines).toHaveLength(5);
      const after = await recoveryCounts(tx);
      expect(after).toEqual({
        ...before,
        attemptsRfef: before.attemptsRfef + 1,
      });
      expect(await boardOf(tx)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ match_id: POSTPONED, status: "scheduled" }),
          expect.objectContaining({ match_id: CLOSED, home_score: 9 }),
        ]),
      );
      const [attempt] = await attempts(tx);
      expect(attempt.ok).toBe(true);
      expect(attempt.raw_ref).toBe(result.rawRef);
      expect(attempt.details).toMatchObject({
        recuperacion: {
          herramienta: "rfef:recuperar",
          desde: DESDE,
          hasta: HASTA,
          dryRun: true,
          partidos: 5,
          fechas: 2,
          insertadas: 0,
          duplicadas: 0,
          descartadasLive: 0,
          cerradosCoinciden: 0,
          cerradosDiscrepan: 1,
          alertas: 0,
          decididas: 0,
        },
      });
    }));

  it("applied: the four scheduled get their Decision at the Sunday instant, the closed one keeps its score and opens ONE conflict, all in one transaction", () =>
    rollback(async (tx) => {
      await seedMatchday(tx);
      const before = await recoveryCounts(tx);
      const { urls, fetch } = explorerDouble();
      const result = await run(tx, fetch, false);
      expect(result.outcome).toBe("aplicado");
      if (result.outcome !== "aplicado") return;
      expect(urls.every((u) => u.startsWith(EXPLORER_URL))).toBe(true);
      expect(result.decided).toMatchObject({ matches: 4, decisions: 4 });
      expect(result.alertsOpened).toBe(1);
      const after = await recoveryCounts(tx);
      expect(after.observationsRfef - before.observationsRfef).toBe(5);
      expect(after.decisions - before.decisions).toBe(4);
      expect(after.alerts - before.alerts).toBe(1);
      expect(result.before).toEqual(before);
      expect(result.after).toEqual(after);

      const board = new Map((await boardOf(tx)).map((r) => [r.match_id, r]));
      expect(board.get(POSTPONED)).toMatchObject({
        status: "postponed",
        home_score: null,
        qualifier: "provisional",
      });
      for (const id of SEEDED.filter((m) => m !== CLOSED && m !== POSTPONED))
        expect(board.get(id)).toMatchObject({
          status: "finished",
          qualifier: "provisional",
        });
      expect(board.get(CLOSED)).toMatchObject({ home_score: 9, away_score: 9 });

      // decided_at is the lastSeenAt of the row (ADR-025 §4), on Sunday.
      const rows = await tx<
        {
          match_id: string;
          decided_at: Date;
          rule: string;
          home_source_id: string;
        }[]
      >`
        select d.match_id, d.decided_at, d.rule, d.home_source_id
        from decisions d join board b on b.decision_id = d.id
        where d.match_id = any(${tx.array(SEEDED)}) and d.match_id <> ${CLOSED}`;
      for (const row of rows) {
        expect(row.decided_at.toISOString()).toMatch(/^2026-11-01T22:58:4/);
        expect(row.rule).toBe("RN-01");
      }
      // The conflict, with the detail of H-7.
      const alerts = await tx<
        { kind: string; match_id: string; details: Record<string, unknown> }[]
      >`
        select kind, match_id, details from alerts
        where match_id = ${CLOSED} and resolved_at is null`;
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({
        kind: "conflict",
        match_id: CLOSED,
        details: {
          sourceId: "rfef",
          current: { home: 9, away: 9 },
          proposed: { home: expect.any(Number), away: expect.any(Number) },
        },
      });
      expect(alerts[0].details.observationId).toEqual(expect.any(String));
      expect(alerts[0].details.decisionId).toEqual(expect.any(String));

      const [attempt] = await attempts(tx);
      expect(attempt.details).toMatchObject({
        recuperacion: {
          herramienta: "rfef:recuperar",
          dryRun: false,
          partidos: 5,
          fechas: 2,
          insertadas: 5,
          duplicadas: 0,
          cerradosCoinciden: 0,
          cerradosDiscrepan: 1,
          alertas: 1,
          decididas: 4,
        },
      });
      expect((await twins(tx))[0].n).toBe(0);
    }));

  it("with the cadence of the rfef busy it retries until the deadline and aborts without a single GET", () =>
    rollback(async (tx) => {
      await seedMatchday(tx);
      await tx`insert into ingest_attempts (source_id, started_at)
        values ('rfef', ${shiftInstant(NOW, -10 * 1000)})`;
      const { urls, fetch } = explorerDouble();
      const slept: number[] = [];
      const result = await run(tx, fetch, false, {
        sleep: async (ms) => {
          slept.push(ms);
        },
        retryMs: 5_000,
        deadlineMs: 90_000,
      });
      expect(result.outcome).toBe("ocupado");
      expect(urls).toEqual([]);
      expect(slept.length).toBeGreaterThan(0);
      expect(slept.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(90_000);
      expect(await attempts(tx)).toHaveLength(0);
      expect((await twins(tx))[0].n).toBe(0);
    }));

  it("with no declared match in the range it asks nothing and opens no attempt", () =>
    rollback(async (tx) => {
      const { urls, fetch } = explorerDouble();
      const result = await run(tx, fetch, false, {
        desde: "2030-01-01",
        hasta: "2030-01-02",
      });
      expect(result.outcome).toBe("sin-partidos");
      expect(urls).toEqual([]);
      expect(await attempts(tx)).toHaveLength(0);
    }));
});

describe("SPEC-044 CA-7 idempotence of rfef:recuperar", () => {
  it("a second run right after: 0 observations, 0 Decisions, 0 alerts, one more attempt", () =>
    rollback(async (tx) => {
      await seedMatchday(tx);
      const first = await run(tx, explorerDouble().fetch, false);
      expect(first.outcome).toBe("aplicado");
      const between = await recoveryCounts(tx);
      // Five minutes later (the cadence of the rfef is 30 s).
      const later = shiftInstant(NOW, 5 * MINUTE_MS);
      const second = await run(tx, explorerDouble().fetch, false, {
        clock: () => later,
      });
      expect(second.outcome).toBe("aplicado");
      if (second.outcome !== "aplicado") return;
      expect(second.decided).toMatchObject({ decisions: 0 });
      expect(second.alertsOpened).toBe(0);
      const after = await recoveryCounts(tx);
      expect(after).toEqual({
        ...between,
        attemptsRfef: between.attemptsRfef + 1,
      });
      expect(second.plan.dropped.duplicate).toBe(5);
      expect((await twins(tx))[0].n).toBe(0);
    }));

  it("if explorer reread the rows (a new lastSeenAt): new observations and 0 Decisions, the same tuple (ADR-009 §2)", () =>
    rollback(async (tx) => {
      await seedMatchday(tx);
      await run(tx, explorerDouble().fetch, false);
      const between = await recoveryCounts(tx);
      const later = shiftInstant(NOW, 5 * MINUTE_MS);
      const second = await run(tx, explorerDouble(120).fetch, false, {
        clock: () => later,
      });
      expect(second.outcome).toBe("aplicado");
      if (second.outcome !== "aplicado") return;
      expect(second.plan.insert).toHaveLength(5);
      // The three the first run decided are finished without the mark now:
      // closed, agreeing, never through the engine (ADR-025 §2/§6). Only
      // the postponed one goes to the engine, and it decides nothing.
      expect(second.decided).toMatchObject({ matches: 1, decisions: 0 });
      expect(
        second.plan.groups.flatMap((g) => g.matchIds),
      ).toEqual([POSTPONED]);
      expect(
        [...second.plan.closed].sort((a, b) =>
          a.matchId.localeCompare(b.matchId),
        ),
      ).toEqual(
        SEEDED.filter((id) => id !== POSTPONED)
          .sort()
          .map((matchId) =>
            matchId === CLOSED
              ? { matchId, agrees: false, alert: expect.any(Object) }
              : { matchId, agrees: true },
          ),
      );
      // The conflict of the closed one is already open: deduplicated.
      expect(second.alertsOpened).toBe(0);
      const after = await recoveryCounts(tx);
      expect(after.observationsRfef - between.observationsRfef).toBe(5);
      expect(after.decisions).toBe(between.decisions);
      expect(after.alerts).toBe(between.alerts);
      expect((await twins(tx))[0].n).toBe(0);
    }));
});

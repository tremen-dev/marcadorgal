import { readFileSync } from "node:fs";
import type { Sql, TransactionSql } from "postgres";
import { describe, expect, it } from "vitest";
import { type Instant, MINUTE_MS, shiftInstant } from "@/model";
import { createMemoryRawStore } from "../raw/memory.ts";
import { SOURCES, sourceConfig } from "../sources/registry.ts";
import { adapterFor } from "./adapters.ts";
import { loadDeclaredCalendar } from "./calendar.ts";
import type { IngestTx } from "./db.ts";
import { createMemoryIngestDb } from "./memory.ts";
import { recuperarRfef } from "./recuperacion-rfef-db.ts";

// SPEC-044 CA-6, the orchestration of rfef:recuperar over doubles: the
// memory IngestDb and RawStore, the real adapter of explorer fed by the real
// exports, and a sql that answers each statement out of the same memory.
// What the statements say to Postgres is proved in
// recuperacion-rfef.db.test.ts; what the tool does with the answers, here.

const root = new URL("../../", import.meta.url);
const EXPORT_DIR = "src/sources/rfef/fixtures/export";
const EXPLORER_URL = "https://explorer.test";
const ENV = {
  API_FOOTBALL_KEY: "not-a-real-key",
  RFEF_EXPLORER_URL: EXPLORER_URL,
  RFEF_EXPLORER_TOKEN: "tok-s3cret",
};
const NOW = "2026-11-02T11:00:00.000Z" as Instant;
const CLOSED = "primera-division-2026-27-j11-levante-atletico-madrid";
const POSTPONED = "segunda-division-2026-27-j12-tenerife-andorra";
const SEEDED = [
  "primera-division-2026-27-j11-barcelona-alaves",
  CLOSED,
  "primera-rfef-g1-2026-27-j10-zamora-deportivo-fabril",
  POSTPONED,
  "tercera-rfef-g1-2026-27-j9-silva-viveiro",
];
const calendar = loadDeclaredCalendar("2026-27");
const config = sourceConfig("rfef");
if (config === undefined) throw new Error("rfef is not registered");

const date = (value: string) => new Date(value);
const CLOSED_DECISION = "dddddddd-dddd-4ddd-8ddd-000000000001";

// lastSeenAt may be shifted to simulate explorer rereading the rows (CA-7).
function explorerDouble(shiftSeconds = 0) {
  const urls: string[] = [];
  const fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    urls.push(url);
    let body = readFileSync(
      new URL(`${EXPORT_DIR}/export-${url.slice(-10)}.json`, root),
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

// The values of `insert into decisions` (engine.ts insertDecision), in order.
type DecisionValues = unknown[];
const CLOSED_VALUES: DecisionValues = [
  CLOSED,
  "finished",
  9,
  9,
  null,
  null,
  "provisional",
  "RN-01",
  [],
  "2026-10-31T15:00:00.000Z",
  null,
  null,
  false,
  false,
];

// The world: five declared matches of the matchday, one closed 9-9 by
// api-football. The sql double answers the board, the counts and the four
// statements of the engine out of the memory db, and records the writes;
// the board and the current Decisions answer what was written, as the
// database would (CA-7: a second run sees the first one's Decisions).
function world() {
  const db = createMemoryIngestDb();
  const decisions: DecisionValues[] = [];
  const alerts = new Set<string>();
  const statements: string[] = [];
  const ids = new Map<DecisionValues, string>([
    [CLOSED_VALUES, CLOSED_DECISION],
  ]);
  const versionOf = (v: DecisionValues) =>
    [CLOSED_VALUES, ...decisions].filter((d) => d[0] === v[0]).indexOf(v) + 1;
  const current = (matchId: string): DecisionValues | undefined =>
    [CLOSED_VALUES, ...decisions].filter((d) => d[0] === matchId).at(-1);
  const rows = (text: string, values: unknown[]): unknown[] => {
    if (text.includes("from board"))
      return SEEDED.map((id) => {
        const m = calendar.find((c) => c.id === id);
        if (m === undefined) throw new Error(`${id} not in the calendar`);
        const d = current(id);
        return {
          match_id: id,
          competition_id: m.competitionId,
          season: "2026-27",
          kickoff: date(m.kickoff),
          home_team_id: m.homeTeamId,
          away_team_id: m.awayTeamId,
          status: d === undefined ? "scheduled" : d[1],
          home_score: d === undefined ? null : d[2],
          away_score: d === undefined ? null : d[3],
          decision_id: d === undefined ? null : ids.get(d),
          forced_finish: d === undefined ? null : d[12],
          decided_at: d === undefined ? null : date(d[9] as string),
        };
      });
    if (text.includes("count(*)::int from decisions) as decisions"))
      return [
        {
          decisions: 1 + decisions.length,
          observations_rfef: db.observations.length,
          alerts: alerts.size,
          attempts_rfef: db.attempts.length,
        },
      ];
    if (text.includes("from matches"))
      return (values[0] as string[]).map((id) => ({
        id,
        competition_id: calendar.find((c) => c.id === id)?.competitionId,
        kickoff: date(calendar.find((c) => c.id === id)?.kickoff ?? NOW),
      }));
    if (text.includes("from decisions"))
      return (values[0] as string[]).flatMap((id) => {
        const d = current(id);
        if (d === undefined) return [];
        return [
          {
            id: ids.get(d),
            match_id: d[0],
            version: versionOf(d),
            status: d[1],
            home_score: d[2],
            away_score: d[3],
            minute: d[4],
            added_minute: d[5],
            half_time: d[13],
            qualifier: d[6],
            rule: d[7],
            observation_ids: d[8],
            decided_at: date(d[9] as string),
            home_source_id: d[10],
            away_source_id: d[11],
            forced_finish: d[12],
          },
        ];
      });
    if (text.includes("distinct on (match_id) match_id, observed_at, status"))
      return [];
    if (text.includes("from observations")) {
      const ids = new Set(values[0] as string[]);
      const since = Date.parse(values[1] as string);
      return db.observations
        .filter((o) => ids.has(o.matchId) && Date.parse(o.observedAt) >= since)
        .map((o) => ({
          id: o.id,
          match_id: o.matchId,
          source_id: o.sourceId,
          status: o.status,
          home_score: o.score?.home ?? null,
          away_score: o.score?.away ?? null,
          minute: null,
          added_minute: null,
          half_time: false,
          observed_at: date(o.observedAt),
          received_at: date(o.receivedAt),
          raw_ref: o.rawRef,
        }));
    }
    if (text.startsWith("insert into decisions")) {
      decisions.push(values);
      ids.set(values, crypto.randomUUID());
      return [];
    }
    if (text.startsWith("insert into alerts")) {
      const key = `${values[0]}|${values[1]}`;
      if (alerts.has(key)) return [];
      alerts.add(key);
      return [{ id: crypto.randomUUID() }];
    }
    return [];
  };
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    statements.push(text);
    return Promise.resolve(rows(text, values));
  };
  sql.array = (value: unknown) => value;
  sql.json = (value: unknown) => value;
  // The memory tx leaves sql undefined: here the engine gets the double.
  const transaction = db.transaction.bind(db);
  db.transaction = (fn) =>
    transaction((tx: IngestTx) =>
      fn({ ...tx, sql: sql as unknown as TransactionSql }),
    );
  return { db, sql: sql as unknown as Sql, decisions, alerts, statements };
}

const run = (
  w: ReturnType<typeof world>,
  fetch: typeof globalThis.fetch,
  dryRun: boolean,
  over: Partial<Parameters<typeof recuperarRfef>[0]> = {},
) =>
  recuperarRfef({
    sql: w.sql,
    db: w.db,
    store: createMemoryRawStore(),
    adapterFor: (c, season) => adapterFor(c, season, ENV),
    config,
    sources: SOURCES,
    fetch,
    clock: () => NOW,
    desde: "2026-10-30",
    hasta: "2026-11-02",
    dryRun,
    sleep: async () => {},
    ...over,
  });

describe("SPEC-044 CA-6 recuperarRfef over doubles", () => {
  it("--dry-run: one attempt with dryRun, one GET per date with matches, the raw kept, the plan printed and nothing written", async () => {
    const w = world();
    const { urls, fetch } = explorerDouble();
    const store = createMemoryRawStore();
    const result = await run(w, fetch, true, { store });
    expect(result.outcome).toBe("en-seco");
    if (result.outcome !== "en-seco") return;
    expect(urls).toEqual([
      `${EXPLORER_URL}/api/export/matches?date=2026-10-31`,
      `${EXPLORER_URL}/api/export/matches?date=2026-11-01`,
    ]);
    expect(store.objects.size).toBe(1);
    expect(result.rawRef).toMatch(/^raw\/rfef\/2026-11-02\//);
    expect(result.plan.insert).toHaveLength(5);
    expect(result.plan.closed).toEqual([
      { matchId: CLOSED, agrees: false, alert: expect.any(Object) },
    ]);
    expect(result.lines).toHaveLength(5);
    expect(result.lines.find((l) => l.startsWith(CLOSED))).toMatch(
      /finished 9-9 {2}→ {2}finished \d+-\d+ {2}· {2}insertar; cerrado, discrepa: alerta conflict/,
    );
    expect(result.lines.find((l) => l.startsWith(POSTPONED))).toMatch(
      /scheduled — {2}→ {2}postponed — {2}· {2}insertar y decidir a 2026-11-01T22:58:4/,
    );
    expect(w.db.observations).toEqual([]);
    expect(w.decisions).toEqual([]);
    expect(w.alerts.size).toBe(0);
    expect(result.decided).toBeNull();
    expect(w.db.attempts).toHaveLength(1);
    expect(w.db.attempts[0].close).toMatchObject({
      ok: true,
      observations: 0,
      rawRef: result.rawRef,
      details: {
        matches: 5,
        requests: 2,
        recuperacion: {
          herramienta: "rfef:recuperar",
          desde: "2026-10-30",
          hasta: "2026-11-02",
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
      },
    });
    expect(result.after).toEqual({
      ...result.before,
      attemptsRfef: result.before.attemptsRfef + 1,
    });
  });

  it("applied: inserts the five, decides the four at their Sunday instant under one lock, opens one conflict for the closed one, in one transaction", async () => {
    const w = world();
    const { urls, fetch } = explorerDouble();
    const result = await run(w, fetch, false);
    expect(result.outcome).toBe("aplicado");
    if (result.outcome !== "aplicado") return;
    expect(urls.every((u) => u.startsWith(EXPLORER_URL))).toBe(true);
    expect(w.db.observations).toHaveLength(5);
    expect(w.db.observations.map((o) => o.sourceId)).toEqual(
      Array(5).fill("rfef"),
    );
    expect(result.decided).toEqual({
      matches: 4,
      decisions: 4,
      alerts: 0,
      resolved: 0,
    });
    // decided_at of every Decision is the lastSeenAt of its observation.
    expect(w.decisions).toHaveLength(4);
    for (const values of w.decisions)
      expect(values[9]).toMatch(/^2026-11-01T22:58:4/);
    expect(w.decisions.map((v) => v[0])).not.toContain(CLOSED);
    expect(w.decisions.find((v) => v[0] === POSTPONED)?.[1]).toBe("postponed");
    expect(result.alertsOpened).toBe(1);
    expect([...w.alerts]).toEqual([`conflict|${CLOSED}`]);
    // One lock for the four, one engine run per instant (ADR-025 §4).
    expect(
      w.statements.filter((s) => s.includes("for no key update")),
    ).toHaveLength(1);
    expect(
      w.statements.filter((s) => s.includes("from decisions where match_id")),
    ).toHaveLength(4);
    // Inside the transaction: begin, the reads, the insert, commit.
    const log = w.db.log;
    expect(log.indexOf("begin")).toBeLessThan(
      log.indexOf("insertObservations:5"),
    );
    expect(log.indexOf("insertObservations:5")).toBeLessThan(
      log.indexOf("commit"),
    );
    expect(w.db.attempts[0].close).toMatchObject({
      ok: true,
      observations: 5,
      details: {
        recuperacion: {
          dryRun: false,
          insertadas: 5,
          duplicadas: 0,
          cerradosDiscrepan: 1,
          alertas: 1,
          decididas: 4,
        },
      },
    });
    expect(result.after).toEqual({
      decisions: result.before.decisions + 4,
      observationsRfef: result.before.observationsRfef + 5,
      alerts: result.before.alerts + 1,
      attemptsRfef: result.before.attemptsRfef + 1,
    });
  });

  it("a second run right after (CA-7): 0 observations, 0 Decisions, 0 alerts, one more attempt", async () => {
    const w = world();
    await run(w, explorerDouble().fetch, false);
    const later = shiftInstant(NOW, 5 * MINUTE_MS);
    const second = await run(w, explorerDouble().fetch, false, {
      clock: () => later,
    });
    expect(second.outcome).toBe("aplicado");
    if (second.outcome !== "aplicado") return;
    expect(second.plan.insert).toEqual([]);
    expect(second.plan.dropped.duplicate).toBe(5);
    expect(second.decided).toEqual({
      matches: 0,
      decisions: 0,
      alerts: 0,
      resolved: 0,
    });
    expect(second.alertsOpened).toBe(0);
    expect(w.db.observations).toHaveLength(5);
    expect(w.decisions).toHaveLength(4);
    expect(w.db.attempts).toHaveLength(2);
  });

  it("if explorer reread the rows (CA-7): new observations, the three decided ones closed and agreeing, only the postponed one through the engine, 0 Decisions", async () => {
    const w = world();
    await run(w, explorerDouble().fetch, false);
    const later = shiftInstant(NOW, 5 * MINUTE_MS);
    const second = await run(w, explorerDouble(120).fetch, false, {
      clock: () => later,
    });
    expect(second.outcome).toBe("aplicado");
    if (second.outcome !== "aplicado") return;
    expect(second.plan.insert).toHaveLength(5);
    expect(second.plan.groups.flatMap((g) => g.matchIds)).toEqual([POSTPONED]);
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
    expect(second.decided).toEqual({
      matches: 1,
      decisions: 0,
      alerts: 0,
      resolved: 0,
    });
    expect(second.alertsOpened).toBe(0);
    expect(w.db.observations).toHaveLength(10);
    expect(w.decisions).toHaveLength(4);
  });

  it("with the cadence busy it retries up to the deadline and aborts without a GET or an attempt", async () => {
    const w = world();
    w.db.cadence.set("rfef", shiftInstant(NOW, -10 * 1000));
    const { urls, fetch } = explorerDouble();
    const slept: number[] = [];
    const result = await run(w, fetch, false, {
      sleep: async (ms) => {
        slept.push(ms);
      },
      retryMs: 5_000,
      deadlineMs: 90_000,
    });
    expect(result).toMatchObject({ outcome: "ocupado", waitedMs: 90_000 });
    expect(slept).toEqual(Array(18).fill(5_000));
    expect(urls).toEqual([]);
    expect(w.db.attempts).toEqual([]);
    expect(w.db.observations).toEqual([]);
  });

  it("with no declared match in the range it asks nothing and opens no attempt", async () => {
    const w = world();
    const { urls, fetch } = explorerDouble();
    const result = await run(w, fetch, false, {
      desde: "2026-11-05",
      hasta: "2026-11-06",
    });
    expect(result).toEqual({ outcome: "sin-partidos", candidates: [] });
    expect(urls).toEqual([]);
    expect(w.db.attempts).toEqual([]);
  });

  it("a fetch that fails closes the attempt as failed, with the tool in its details, and rethrows", async () => {
    const w = world();
    const fetch = (async () =>
      new Response("{}", {
        status: 503,
      })) as unknown as typeof globalThis.fetch;
    await expect(run(w, fetch, false)).rejects.toThrow(
      /rfef explorer responded 503/,
    );
    expect(w.db.attempts).toHaveLength(1);
    expect(w.db.attempts[0].close).toMatchObject({
      ok: false,
      error: "rfef explorer responded 503",
      details: {
        recuperacion: { herramienta: "rfef:recuperar", dryRun: false },
      },
    });
    expect(w.db.observations).toEqual([]);
  });
});

import type { TransactionSql } from "postgres";
import { describe, expect, it } from "vitest";
import { type Instant, MINUTE_MS, shiftInstant } from "@/model";
import { SOURCES } from "../sources/registry.ts";
import type { IngestTx } from "./db.ts";
import { createEngineHook, decideMatches, priorityLookup } from "./engine.ts";

const NOW = "2026-09-25T19:30:00.000Z" as Instant;
const at = (minutes: number) => shiftInstant(NOW, minutes * MINUTE_MS);
const MATCH = "primera-division-2026-27-j6-celta-deportivo";

type Call = { text: string; values: unknown[] };

// A tx.sql that records every statement and answers with canned rows: the
// double of src/ingest/memory.ts leaves sql undefined on purpose, so the
// shape of the SQL is proved here and its behaviour in engine.db.test.ts.
function fakeTx(rows: (text: string) => unknown[] = () => []) {
  const calls: Call[] = [];
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("?").replace(/\s+/g, " ").trim();
    calls.push({ text, values });
    return Promise.resolve(rows(text));
  };
  sql.array = (value: unknown) => value;
  sql.json = (value: unknown) => value;
  const tx: IngestTx = {
    sql: sql as unknown as TransactionSql,
    insertObservations: async () => {},
    openUnresolvedAlerts: async () => 0,
  };
  return { tx, calls };
}

const matchRow = {
  id: MATCH,
  competition_id: "primera-division",
  kickoff: new Date(NOW),
};

const observationRow = (over: Record<string, unknown> = {}) => ({
  id: "11111111-1111-4111-8111-111111111111",
  match_id: MATCH,
  source_id: "api-football",
  status: "live",
  home_score: 1,
  away_score: 0,
  minute: 20,
  added_minute: null,
  observed_at: new Date(at(-1)),
  received_at: new Date(at(-1)),
  raw_ref: "raw/x.json.gz",
  ...over,
});

const decisionRow = (over: Record<string, unknown> = {}) => ({
  id: "22222222-2222-4222-8222-222222222222",
  match_id: MATCH,
  version: 3,
  status: "live",
  home_score: 1,
  away_score: 0,
  minute: 20,
  added_minute: null,
  qualifier: "provisional",
  rule: "RN-01",
  observation_ids: ["33333333-3333-4333-8333-333333333333"],
  decided_at: new Date(at(-1)),
  ...over,
});

const answering =
  (over: Record<string, unknown[]> = {}) =>
  (text: string): unknown[] => {
    if (text.includes("from matches")) return over.matches ?? [matchRow];
    if (text.includes("from decisions")) return over.decisions ?? [];
    if (text.includes("from observations")) return over.observations ?? [];
    if (text.startsWith("insert into alerts")) return over.alerts ?? [];
    if (text.startsWith("update alerts")) return over.resolved ?? [];
    return [];
  };

const find = (calls: Call[], fragment: string) =>
  calls.find((c) => c.text.includes(fragment));

describe("CA-9 the three queries", () => {
  it("asks for the matches, their current decisions and fifteen minutes of observations", async () => {
    const { tx, calls } = fakeTx(answering());
    await decideMatches(tx, [MATCH, MATCH, "other-match"], NOW, SOURCES);

    const ids = ["other-match", MATCH];
    const matches = find(calls, "from matches");
    expect(matches?.text).toContain("select id, competition_id, kickoff");
    expect(matches?.text).toContain("where id = any(?)");
    expect(matches?.values[0]).toEqual(ids);

    const decisions = find(calls, "from decisions");
    expect(decisions?.text).toContain("distinct on (match_id)");
    expect(decisions?.text).toContain("order by match_id, version desc");
    expect(decisions?.values[0]).toEqual(ids);

    const observations = find(calls, "from observations");
    expect(observations?.text).toContain("observed_at >= ?");
    expect(observations?.text).toContain("order by observed_at");
    expect(observations?.values).toEqual([ids, at(-15)]);
  });

  it("asks nothing with no match ids", async () => {
    const { tx, calls } = fakeTx(answering());
    expect(await decideMatches(tx, [], NOW, SOURCES)).toEqual({
      matches: 0,
      decisions: 0,
      alerts: 0,
      resolved: 0,
    });
    expect(calls).toEqual([]);
  });
});

describe("CA-9 writing a decision", () => {
  it("inserts it without a version and without an id (ADR-006 §3)", async () => {
    const { tx, calls } = fakeTx(
      answering({ observations: [observationRow()] }),
    );
    const counts = await decideMatches(tx, [MATCH], NOW, SOURCES);
    expect(counts).toMatchObject({ matches: 1, decisions: 1, alerts: 0 });

    const insert = find(calls, "insert into decisions");
    expect(insert).toBeDefined();
    expect(insert?.text).not.toContain("version");
    expect(insert?.text).not.toContain(" id,");
    expect(insert?.text).toContain("::uuid[]");
    expect(insert?.values).toEqual([
      MATCH,
      "live",
      1,
      0,
      20,
      null,
      "provisional",
      "RN-01",
      ["11111111-1111-4111-8111-111111111111"],
      NOW,
    ]);
  });

  it("writes nothing when the tuple does not move (H-1)", async () => {
    const { tx, calls } = fakeTx(
      answering({
        observations: [observationRow()],
        decisions: [decisionRow()],
      }),
    );
    const counts = await decideMatches(tx, [MATCH], NOW, SOURCES);
    expect(counts).toMatchObject({ matches: 1, decisions: 0 });
    expect(find(calls, "insert into decisions")).toBeUndefined();
  });
});

describe("CA-9 opening and resolving alerts", () => {
  const regression = {
    observations: [observationRow({ home_score: 0, away_score: 0 })],
    decisions: [decisionRow()],
  };

  it("guards every kind with the same not exists (N-3)", async () => {
    const { tx, calls } = fakeTx(
      answering({ ...regression, alerts: [{ id: "alert-1" }] }),
    );
    const counts = await decideMatches(tx, [MATCH], NOW, SOURCES);
    expect(counts).toMatchObject({ alerts: 1 });

    const insert = find(calls, "insert into alerts");
    expect(insert?.text).toContain("where not exists");
    expect(insert?.text).toContain("a.resolved_at is null");
    expect(insert?.values.slice(0, 2)).toEqual(["regression", MATCH]);
    expect(insert?.values.slice(3)).toEqual(["regression", MATCH]);
  });

  it("counts nothing when the alert is already open", async () => {
    const { tx } = fakeTx(answering({ ...regression, alerts: [] }));
    expect(await decideMatches(tx, [MATCH], NOW, SOURCES)).toMatchObject({
      alerts: 0,
    });
  });

  it("dedupes forced_finish the same way", async () => {
    const forced = answering({
      decisions: [decisionRow({ minute: 90 })],
      matches: [{ ...matchRow, kickoff: new Date(at(-121)) }],
      alerts: [],
    });
    const { tx, calls } = fakeTx(forced);
    const counts = await decideMatches(tx, [MATCH], NOW, SOURCES);
    const insert = find(calls, "insert into alerts");
    expect(insert?.values.slice(0, 2)).toEqual(["forced_finish", MATCH]);
    expect(insert?.text).toContain("where not exists");
    expect(counts).toMatchObject({ decisions: 1, alerts: 0 });
  });

  it("closes the silence with resolved_at = now", async () => {
    const { tx, calls } = fakeTx(
      answering({
        observations: [observationRow({ minute: 21 })],
        decisions: [decisionRow({ qualifier: "sen_sinal" })],
        resolved: [{ id: "alert-2" }],
      }),
    );
    const counts = await decideMatches(tx, [MATCH], NOW, SOURCES);
    expect(counts).toMatchObject({ resolved: 1 });

    const update = find(calls, "update alerts");
    expect(update?.text).toContain("set resolved_at = ?");
    expect(update?.text).toContain("kind = any(?)");
    expect(update?.text).toContain("resolved_at is null");
    expect(update?.values).toEqual([NOW, MATCH, ["silence"]]);
  });
});

describe("CA-9 priorityLookup", () => {
  const FIVE = [
    "primera-division",
    "segunda-division",
    "primera-rfef-g1",
    "segunda-rfef-g1",
    "tercera-rfef-g1",
  ];

  it.each(FIVE)("gives api-football priority 10 in %s", (competition) => {
    expect(priorityLookup(SOURCES, competition)("api-football")).toBe(10);
  });

  it("gives the operator 100 and an unknown source nothing", () => {
    const lookup = priorityLookup(SOURCES, "primera-division");
    expect(lookup("operator")).toBe(100);
    expect(lookup("whoever")).toBeUndefined();
  });

  it("gives nothing for a competition the source does not cover", () => {
    expect(
      priorityLookup(SOURCES, "premier-league")("api-football"),
    ).toBeUndefined();
  });
});

describe("CA-9 createEngineHook", () => {
  it("decides only the matches of the observations it was handed", async () => {
    const { tx, calls } = fakeTx(answering());
    const hook = createEngineHook(SOURCES, NOW);
    await hook(tx, [{ matchId: MATCH }, { matchId: MATCH }] as Parameters<
      typeof hook
    >[1]);
    expect(find(calls, "from matches")?.values[0]).toEqual([MATCH]);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AliasFile,
  type Instant,
  type MatchId,
  Observation,
  type RawCapture,
  type SourceId,
} from "../model/index.ts";
import { createRfefExplorer, madridDateOf } from "../sources/rfef/explorer.ts";
import { loadDeclaredCalendar } from "./calendar.ts";
import {
  parseRecoveryArgs,
  planLines,
  planRecovery,
  type RecoveryCurrent,
  type RecoveryLastOwn,
  recoveryDates,
} from "./recuperacion-rfef.ts";

// SPEC-044 CA-3 (ADR-025 §2-§6): the pure plan of a recovery, over the real
// exports of explorer of the matchday 2026-10-30/11-02 and a synthetic board
// of its 49 matches: 39 scheduled, 9 finished without the mark of the forced
// finish and 1 with it. No clock, no network, no database.

const root = new URL("../../", import.meta.url);
const readJson = (rel: string): unknown =>
  JSON.parse(readFileSync(new URL(rel, root), "utf8"));
const EXPORT_DIR = "src/sources/rfef/fixtures/export";

const aliases = AliasFile.parse(readJson("data/alias/2026-27/rfef.json"));
const calendar = loadDeclaredCalendar("2026-27");
const adapter = createRfefExplorer({
  aliases,
  calendar,
  baseUrl: "https://explorer.test",
  token: "tok",
});

const RECEIVED_AT = "2026-11-02T10:00:00.000Z" as Instant;
const RAW_REF = "raw/rfef/2026-11-02/x.json.gz";

// The observations of a fixture as the tick builds them (SPEC-005 N-1).
function observationsOf(file: string): Observation[] {
  const capture: RawCapture = {
    sourceId: "rfef" as SourceId,
    capturedAt: RECEIVED_AT,
    requests: [
      {
        url: "https://explorer.test/api/export/matches?date=x",
        method: "GET",
        status: 200,
        contentType: "application/json",
        body: readFileSync(new URL(`${EXPORT_DIR}/${file}`, root), "utf8"),
      },
    ],
  };
  return adapter.parse(capture).observations.map((o) =>
    Observation.parse({
      ...o,
      id: crypto.randomUUID(),
      sourceId: "rfef",
      observedAt: o.observedAt ?? RECEIVED_AT,
      receivedAt: RECEIVED_AT,
      rawRef: RAW_REF,
    }),
  );
}

const deployed = [
  ...observationsOf("export-2026-10-31.json"),
  ...observationsOf("export-2026-11-01.json"),
];
const localLive = observationsOf("export-local-2026-11-01.json").filter(
  (o) => o.status === "live",
);

// The 49 declared matches of the matchday, by Europe/Madrid date.
const matchday = calendar.filter((m) => {
  const day = madridDateOf(m.kickoff);
  return day >= "2026-10-30" && day <= "2026-11-02";
});

// The nine closed by the source and the one forced closed: the first ten
// observed matches by id, so the board is deterministic. Eight of the nine
// closed carry the score the export gives; the ninth disagrees.
const observed = [...new Set(deployed.map((o) => o.matchId))].sort();
const closedIds = observed.slice(0, 9);
const forcedId = observed[9];
const discrepantId = closedIds[8];
const scoreOf = (matchId: string) => {
  const o = deployed.find((x) => x.matchId === matchId);
  return o?.score ?? null;
};
const DECISION = "dddddddd-dddd-4ddd-8ddd-";
const decisionId = (n: number) => `${DECISION}${String(n).padStart(12, "0")}`;

const board: RecoveryCurrent[] = matchday.map((m, i) => {
  if (closedIds.includes(m.id)) {
    const score = scoreOf(m.id);
    return {
      matchId: m.id,
      decisionId: decisionId(i + 1),
      status: "finished",
      score:
        m.id === discrepantId && score !== null
          ? { home: score.home + 1, away: score.away }
          : score,
      forcedFinish: false,
    };
  }
  if (m.id === forcedId)
    return {
      matchId: m.id,
      decisionId: decisionId(i + 1),
      status: "finished",
      score: { home: 0, away: 0 },
      forcedFinish: true,
    };
  return {
    matchId: m.id,
    decisionId: null,
    status: "scheduled",
    score: null,
    forcedFinish: null,
  };
});

const asLastOwn = (observations: Observation[]): RecoveryLastOwn[] =>
  observations.map((o) => ({
    matchId: o.matchId,
    observedAt: o.observedAt,
    status: o.status,
    score: o.score,
  }));

const plan = (over: Partial<Parameters<typeof planRecovery>[0]> = {}) =>
  planRecovery({
    observations: deployed,
    currents: board,
    lastOwn: [],
    inCommonWindow: new Set(),
    ...over,
  });

describe("SPEC-044 CA-3 planRecovery over the exports of 2026-10-31 and 2026-11-01", () => {
  it("reads 44 observations of the five competitions out of the two exports and 49 matches of the matchday", () => {
    expect(deployed).toHaveLength(44);
    expect(deployed.map((o) => o.status)).toEqual(
      expect.arrayContaining(["finished", "postponed"]),
    );
    expect(matchday).toHaveLength(49);
    expect(board.filter((c) => c.status === "scheduled")).toHaveLength(39);
    expect(
      board.filter((c) => c.status === "finished" && c.forcedFinish !== true),
    ).toHaveLength(9);
    expect(board.filter((c) => c.forcedFinish === true)).toHaveLength(1);
  });

  it("inserts the 44 and groups 35 of them, one instant each, ascending (the forced finish enters, the nine closed do not)", () => {
    const result = plan();
    expect(result.insert).toHaveLength(44);
    expect(result.dropped).toEqual({ live: 0, duplicate: 0, inWindow: 0 });
    const grouped = result.groups.flatMap((g) => g.matchIds);
    expect(grouped).toHaveLength(35);
    expect(result.groups).toHaveLength(35);
    expect(grouped).toContain(forcedId);
    for (const id of closedIds) expect(grouped).not.toContain(id);
    // Every group is the observedAt of its observations, ascending.
    const instants = result.groups.map((g) => g.now);
    expect([...instants].sort()).toEqual(instants);
    expect(new Set(instants).size).toBe(instants.length);
    for (const group of result.groups)
      for (const id of group.matchIds)
        expect(
          result.insert.some(
            (o) => o.matchId === id && o.observedAt === group.now,
          ),
        ).toBe(true);
  });

  it("drops a LIVE_PROVISIONAL of the local export of 2026-11-01: only final states are heard (ADR-025 §3)", () => {
    expect(localLive.length).toBeGreaterThan(0);
    const live = localLive[0];
    const result = plan({ observations: [...deployed, live] });
    expect(result.dropped.live).toBe(1);
    expect(result.insert.map((o) => o.id)).not.toContain(live.id);
    expect(result.insert).toHaveLength(44);
  });

  it("leaves a match of the common window to the tick", () => {
    const inWindow = observed[20];
    const result = plan({ inCommonWindow: new Set([inWindow]) });
    expect(result.dropped.inWindow).toBe(1);
    expect(result.insert).toHaveLength(43);
    expect(result.insert.map((o) => o.matchId)).not.toContain(inWindow);
    expect(result.groups.flatMap((g) => g.matchIds)).not.toContain(inWindow);
  });

  it("repeated with lastOwn = what was inserted, inserts nothing and groups nothing (ADR-025 §5)", () => {
    const first = plan();
    const again = plan({ lastOwn: asLastOwn(first.insert) });
    expect(again.insert).toEqual([]);
    expect(again.groups).toEqual([]);
    expect(again.dropped).toEqual({ live: 0, duplicate: 44, inWindow: 0 });
    expect(again.closed).toEqual([]);
  });

  it("a last own observation with another lastSeenAt is not a duplicate: inserted, but it is the engine who says whether anything changes", () => {
    const first = plan();
    const older = asLastOwn(first.insert).map((o) => ({
      ...o,
      observedAt: "2026-11-01T20:00:00.000Z" as Instant,
    }));
    const again = plan({ lastOwn: older });
    expect(again.insert).toHaveLength(44);
    expect(again.dropped.duplicate).toBe(0);
  });

  it("for the nine closed: eight agree and nothing is opened; the one that disagrees gets ONE conflict alert with the detail (ADR-025 §6, H-7)", () => {
    const result = plan();
    expect(result.closed).toHaveLength(9);
    expect(result.closed.filter((c) => c.agrees)).toHaveLength(8);
    const [discrepant] = result.closed.filter((c) => !c.agrees);
    expect(discrepant.matchId).toBe(discrepantId);
    const observation = deployed.find((o) => o.matchId === discrepantId);
    const current = board.find((c) => c.matchId === discrepantId);
    expect(discrepant.alert).toEqual({
      kind: "conflict",
      matchId: discrepantId as MatchId,
      details: {
        sourceId: "rfef",
        observationId: observation?.id,
        current: current?.score,
        proposed: observation?.score,
        decisionId: current?.decisionId,
      },
    });
    expect(result.closed.filter((c) => c.alert !== undefined)).toHaveLength(1);
    // The closed ones are still inserted: the observation is kept (§6).
    for (const id of closedIds)
      expect(result.insert.map((o) => o.matchId)).toContain(id);
  });
});

// SPEC-044 CA-6: the pure side of npm run rfef:recuperar. Dates are
// Europe/Madrid days, inclusive, at most seven; the plan is printed one
// line per match (match, current, proposed, action).
describe("SPEC-044 CA-6 parseRecoveryArgs and recoveryDates", () => {
  it("reads --desde, --hasta and --dry-run", () => {
    expect(
      parseRecoveryArgs(["--desde", "2026-10-30", "--hasta", "2026-11-02"]),
    ).toEqual({ desde: "2026-10-30", hasta: "2026-11-02", dryRun: false });
    expect(
      parseRecoveryArgs([
        "--dry-run",
        "--desde",
        "2026-10-30",
        "--hasta",
        "2026-10-30",
      ]),
    ).toEqual({ desde: "2026-10-30", hasta: "2026-10-30", dryRun: true });
  });

  it.each([
    [[], /--desde/],
    [["--desde", "2026-10-30"], /--hasta/],
    [["--desde", "30/10/2026", "--hasta", "2026-11-02"], /YYYY-MM-DD/],
    [["--desde", "2026-11-02", "--hasta", "2026-10-30"], /anterior/],
    [["--desde", "2026-10-27", "--hasta", "2026-11-03"], /7 días/],
    [["--desde", "2026-10-30", "--hasta", "2026-11-02", "--todo"], /--todo/],
    [["--desde", "2026-10-30", "--hasta", "2026-11-02", "extra"], /extra/],
  ])("rejects %j", (argv, reason) => {
    expect(() => parseRecoveryArgs(argv)).toThrow(reason);
  });

  it("seven days inclusive is the most it takes", () => {
    expect(
      parseRecoveryArgs(["--desde", "2026-10-27", "--hasta", "2026-11-02"]),
    ).toMatchObject({ desde: "2026-10-27", hasta: "2026-11-02" });
    expect(recoveryDates("2026-10-30", "2026-11-02")).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
    expect(recoveryDates("2026-11-02", "2026-11-02")).toEqual(["2026-11-02"]);
  });
});

describe("SPEC-044 CA-6 planLines prints match, current, proposed and action", () => {
  it("one line per observation of the plan, and the dropped ones with their reason", () => {
    const first = plan();
    const lines = planLines(first, board, deployed);
    expect(lines).toHaveLength(44);
    const forced = lines.find((l) => l.startsWith(forcedId));
    expect(forced).toMatch(/finished 0-0 \(cierre forzoso\)/);
    expect(forced).toMatch(/decidir a \d{4}-\d{2}-\d{2}T/);
    const discrepant = lines.find((l) => l.startsWith(discrepantId));
    expect(discrepant).toMatch(/alerta conflict/);
    const agreeing = lines.find((l) => l.startsWith(closedIds[0]));
    expect(agreeing).toMatch(/cerrado, coincide/);
    const scheduled = lines.find((l) => l.startsWith(observed[20]));
    expect(scheduled).toMatch(/scheduled —/);
    expect(scheduled).toMatch(/insertar y decidir/);
    const postponed = lines.find((l) =>
      l.startsWith("segunda-division-2026-27-j12-tenerife-andorra"),
    );
    expect(postponed).toMatch(/postponed —/);
  });

  it("names the duplicates and the live it dropped", () => {
    const first = plan();
    const again = plan({
      lastOwn: asLastOwn(first.insert),
      observations: [...deployed, localLive[0]],
    });
    const lines = planLines(again, board, [...deployed, localLive[0]]);
    expect(lines.filter((l) => l.includes("duplicada"))).toHaveLength(44);
    expect(lines.filter((l) => l.includes("live descartado"))).toHaveLength(1);
  });
});

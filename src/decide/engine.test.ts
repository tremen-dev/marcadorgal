import { beforeEach, describe, expect, it } from "vitest";
import {
  type CompetitionId,
  type Decision,
  type DecisionId,
  type Instant,
  type MatchId,
  type MatchState,
  MINUTE_MS,
  type Observation,
  type ObservationId,
  type SourceId,
  shiftInstant,
} from "../model/index.ts";
import { decide } from "./engine.ts";
import type { EngineInput, EngineMatch } from "./types.ts";

const KICKOFF = "2026-09-25T18:30:00.000Z" as Instant;
const MATCH: EngineMatch = {
  id: "primera-division-2026-27-j6-celta-deportivo" as MatchId,
  competitionId: "primera-division" as CompetitionId,
  kickoff: KICKOFF,
};

// Minutes from kickoff, never a clock (CA-12).
const at = (minutes: number): Instant =>
  shiftInstant(KICKOFF, minutes * MINUTE_MS);

// Deterministic ids: no crypto, no randomness inside src/decide/ (CA-12).
let seq = 0;
beforeEach(() => {
  seq = 0;
});
const nextId = (): ObservationId =>
  `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}` as ObservationId;

const CURRENT_OBSERVATION =
  "ffffffff-ffff-4fff-8fff-ffffffffffff" as ObservationId;

const live = (home: number, away: number, minute: number | null = null) =>
  ({
    status: "live",
    score: { home, away },
    minute,
    addedMinute: null,
  }) as const;
const finished = (home: number, away: number) =>
  ({ status: "finished", score: { home, away }, minute: null }) as const;
const scheduled = { status: "scheduled", score: null, minute: null } as const;
const postponed = { status: "postponed", score: null, minute: null } as const;

const obs = (
  sourceId: string,
  minutes: number,
  state: MatchState,
): Observation =>
  ({
    ...state,
    id: nextId(),
    matchId: MATCH.id,
    sourceId: sourceId as SourceId,
    observedAt: at(minutes),
    receivedAt: at(minutes),
    rawRef: "raw/2026-09-25/api-football/x.json.gz",
  }) as Observation;

const current = (state: MatchState, extra: Partial<Decision> = {}): Decision =>
  ({
    ...state,
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as DecisionId,
    matchId: MATCH.id,
    version: 1,
    qualifier: "provisional",
    rule: "RN-01",
    observationIds: [CURRENT_OBSERVATION],
    decidedAt: at(0),
    ...extra,
  }) as Decision;

const priorities =
  (map: Record<string, number>) =>
  (sourceId: string): number | undefined =>
    map[sourceId];

const input = (over: Partial<EngineInput>): EngineInput => ({
  match: MATCH,
  current: null,
  observations: [],
  priority: priorities({ ten: 10, twenty: 20, fifty: 50, operator: 100 }),
  now: at(50),
  ...over,
});

describe("CA-3 RN-01 priority among the recent observations", () => {
  it("gives it to the source with the highest priority", () => {
    const { decision } = decide(
      input({
        observations: [
          obs("ten", 49, live(1, 0, 50)),
          obs("twenty", 49, live(2, 0, 50)),
        ],
      }),
    );
    expect(decision).toMatchObject({
      status: "live",
      score: { home: 2, away: 0 },
      rule: "RN-01",
    });
  });

  it("gives it to the most recent at equal priority", () => {
    const older = obs("ten", 47, live(1, 0, 48));
    const newer = obs("other-ten", 49, live(2, 0, 50));
    const { decision } = decide(
      input({
        observations: [newer, older],
        priority: priorities({ ten: 10, "other-ten": 10 }),
      }),
    );
    expect(decision).toMatchObject({ score: { home: 2, away: 0 } });
    expect(decision?.observationIds).toEqual([newer.id]);
  });

  it("ignores a source with no priority", () => {
    const { decision } = decide(
      input({
        observations: [
          obs("ten", 49, live(1, 0, 50)),
          obs("unknown", 49, live(9, 9, 50)),
        ],
      }),
    );
    expect(decision).toMatchObject({ score: { home: 1, away: 0 } });
  });

  it("ignores an observation older than the five minute window", () => {
    const { decision } = decide(
      input({ observations: [obs("ten", 44, live(1, 0, 45))], now: at(50) }),
    );
    expect(decision).toBeNull();
  });

  it("keeps only the most recent observation of each source", () => {
    const newer = obs("ten", 49, live(2, 0, 50));
    const { decision } = decide(
      input({ observations: [obs("ten", 46, live(1, 0, 47)), newer] }),
    );
    expect(decision?.observationIds).toEqual([newer.id]);
  });

  it("does not depend on the order of the observations", () => {
    const a = obs("ten", 46, live(1, 0, 47));
    const b = obs("twenty", 49, live(2, 0, 50));
    const one = decide(input({ observations: [a, b] }));
    const other = decide(input({ observations: [b, a] }));
    expect(one).toEqual(other);
  });
});

describe("CA-3 RN-02 transitions", () => {
  it("does not believe live sixteen minutes before kickoff", () => {
    expect(
      decide(
        input({ observations: [obs("ten", -16, live(0, 0, 1))], now: at(-16) }),
      ),
    ).toEqual({ decision: null, open: [], resolve: [] });
  });

  it("believes live fifteen minutes before kickoff", () => {
    const { decision } = decide(
      input({
        observations: [obs("ten", -15, live(0, 0, null))],
        now: at(-15),
      }),
    );
    expect(decision).toMatchObject({ status: "live", rule: "RN-01" });
  });

  it("does not believe finished before kickoff", () => {
    const { decision } = decide(
      input({ observations: [obs("ten", -1, finished(2, 1))], now: at(-1) }),
    );
    expect(decision).toBeNull();
  });

  it("believes finished from kickoff on (N-4)", () => {
    const { decision } = decide(
      input({ observations: [obs("ten", 0, finished(2, 1))], now: at(0) }),
    );
    expect(decision).toMatchObject({ status: "finished", rule: "RN-01" });
  });

  it("does not publish postponed from a provider", () => {
    const { decision } = decide(
      input({ observations: [obs("ten", 49, postponed)] }),
    );
    expect(decision).toBeNull();
  });

  it("publishes postponed from a federation source", () => {
    const { decision } = decide(
      input({ observations: [obs("fifty", 49, postponed)] }),
    );
    expect(decision).toMatchObject({ status: "postponed", rule: "RN-01" });
  });

  it("never goes back from finished", () => {
    const { decision } = decide(
      input({
        current: current(finished(2, 1)),
        observations: [obs("ten", 49, live(2, 1, 90))],
      }),
    );
    expect(decision).toBeNull();
  });

  it("does publish a finished with a higher score (RN-01)", () => {
    const { decision } = decide(
      input({
        current: current(finished(2, 1)),
        observations: [obs("ten", 49, finished(3, 1))],
      }),
    );
    expect(decision).toMatchObject({
      status: "finished",
      score: { home: 3, away: 1 },
      rule: "RN-01",
    });
  });
});

describe("CA-3 the operator", () => {
  it("publishes as is, with a lower score and no alert", () => {
    const { decision, open } = decide(
      input({
        current: current(live(2, 1, 70)),
        observations: [obs("operator", 49, live(2, 0, 75))],
      }),
    );
    expect(decision).toMatchObject({
      score: { home: 2, away: 0 },
      minute: 75,
      rule: "operator",
      qualifier: "confirmado",
    });
    expect(open).toEqual([]);
  });
});

describe("CA-3 idempotence (H-1)", () => {
  it("publishes nothing when the tuple does not move", () => {
    const { decision } = decide(
      input({
        current: current(live(1, 0, 50), { qualifier: "provisional" }),
        observations: [obs("ten", 49, live(1, 0, 50))],
      }),
    );
    expect(decision).toBeNull();
  });

  it("publishes when only the minute moves (H-1)", () => {
    const { decision } = decide(
      input({
        current: current(live(1, 0, 50)),
        observations: [obs("ten", 49, live(1, 0, 51))],
      }),
    );
    expect(decision).toMatchObject({ minute: 51 });
  });

  it("decidedAt is now", () => {
    const { decision } = decide(
      input({ observations: [obs("ten", 49, live(1, 0, 50))], now: at(50) }),
    );
    expect(decision?.decidedAt).toBe(at(50));
  });
});

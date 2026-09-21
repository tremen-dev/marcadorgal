import { beforeEach, describe, expect, it } from "vitest";
import {
  type CompetitionId,
  Decision,
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

describe("CA-4 RN-03 monotony and the regression alert", () => {
  const vigente = current(live(2, 1, 70));

  it("holds the current score and takes the proposed status and minute", () => {
    const observation = obs("ten", 49, live(2, 0, 75));
    const { decision, open } = decide(
      input({ current: vigente, observations: [observation] }),
    );
    expect(decision).toMatchObject({
      status: "live",
      score: { home: 2, away: 1 },
      minute: 75,
      rule: "RN-03",
    });
    expect(open).toEqual([
      {
        kind: "regression",
        matchId: MATCH.id,
        details: {
          sourceId: "ten",
          observationId: observation.id,
          current: { home: 2, away: 1 },
          proposed: { home: 2, away: 0 },
        },
      },
    ]);
  });

  it("never mixes sides: 1-2 against 2-1 holds 2-1, not 2-2", () => {
    const { decision } = decide(
      input({
        current: vigente,
        observations: [obs("ten", 49, live(1, 2, 75))],
      }),
    );
    expect(decision).toMatchObject({ score: { home: 2, away: 1 } });
  });

  it("does not fire when both sides grow", () => {
    const { decision, open } = decide(
      input({
        current: vigente,
        observations: [obs("ten", 49, live(3, 1, 75))],
      }),
    );
    expect(decision).toMatchObject({
      score: { home: 3, away: 1 },
      rule: "RN-01",
    });
    expect(open).toEqual([]);
  });

  it("does not apply to the operator (RN-03)", () => {
    const { decision, open } = decide(
      input({
        current: vigente,
        observations: [obs("operator", 49, live(2, 0, 75))],
      }),
    );
    expect(decision).toMatchObject({
      score: { home: 2, away: 0 },
      rule: "operator",
    });
    expect(open).toEqual([]);
  });

  it("does not apply when the current decision carries no score", () => {
    const { decision, open } = decide(
      input({
        current: current(scheduled),
        observations: [obs("ten", 49, live(0, 0, 3))],
      }),
    );
    expect(decision).toMatchObject({ status: "live", rule: "RN-01" });
    expect(open).toEqual([]);
  });

  it("does not apply when the proposed state carries no score", () => {
    const { decision, open } = decide(
      input({ current: vigente, observations: [obs("fifty", 49, postponed)] }),
    );
    expect(decision).toMatchObject({ status: "postponed", rule: "RN-01" });
    expect(open).toEqual([]);
  });
});

describe("CA-5 RN-04 conflict between adjacent sources", () => {
  const TWO_TENS = priorities({ ten: 10, "other-ten": 10 });
  const VIGENTE = current(live(0, 0, 45));

  it("holds the current decision and opens an alert past the grace", () => {
    const { decision, open } = decide(
      input({
        current: VIGENTE,
        observations: [
          obs("ten", 44, live(0, 0, 45)),
          obs("other-ten", 44, live(0, 0, 45)),
          obs("ten", 46, live(1, 0, 47)),
          obs("other-ten", 48, live(0, 0, 49)),
          obs("ten", 49, live(1, 0, 50)),
        ],
        priority: TWO_TENS,
      }),
    );
    expect(decision).toBeNull();
    expect(open).toEqual([
      {
        kind: "conflict",
        matchId: MATCH.id,
        details: {
          winner: { sourceId: "ten", score: { home: 1, away: 0 } },
          rival: { sourceId: "other-ten", score: { home: 0, away: 0 } },
          since: at(46),
        },
      },
    ]);
  });

  it("publishes inside the grace", () => {
    const { decision, open } = decide(
      input({
        current: VIGENTE,
        observations: [
          obs("ten", 44, live(0, 0, 45)),
          obs("other-ten", 44, live(0, 0, 45)),
          obs("other-ten", 47, live(0, 0, 48)),
          obs("ten", 48, live(1, 0, 49)),
          obs("ten", 49, live(1, 0, 50)),
        ],
        priority: TWO_TENS,
      }),
    );
    expect(decision).toMatchObject({ score: { home: 1, away: 0 } });
    expect(open).toEqual([]);
  });

  it("forgets the disagreement once the two meet again", () => {
    const { decision, open } = decide(
      input({
        current: VIGENTE,
        observations: [
          obs("ten", 44, live(0, 0, 45)),
          obs("other-ten", 44, live(0, 0, 45)),
          obs("ten", 46, live(1, 0, 47)),
          obs("other-ten", 49, live(1, 0, 50)),
        ],
        priority: TWO_TENS,
      }),
    );
    expect(decision).toMatchObject({ score: { home: 1, away: 0 } });
    expect(open).toEqual([]);
  });

  it("dates a new disagreement from the last time they met, not the first", () => {
    const { decision, open } = decide(
      input({
        current: VIGENTE,
        observations: [
          obs("ten", 44, live(0, 0, 45)),
          obs("other-ten", 44, live(0, 0, 45)),
          obs("ten", 46, live(1, 0, 47)),
          obs("other-ten", 48, live(1, 0, 49)),
          obs("ten", 49.5, live(2, 0, 50)),
        ],
        priority: TWO_TENS,
      }),
    );
    expect(decision).toMatchObject({ score: { home: 2, away: 0 } });
    expect(open).toEqual([]);
  });

  it("fires between 10 and 20 with nothing in between (H-4)", () => {
    const { decision, open } = decide(
      input({
        current: VIGENTE,
        observations: [
          obs("ten", 44, live(0, 0, 45)),
          obs("twenty", 44, live(0, 0, 45)),
          obs("twenty", 46, live(1, 0, 47)),
          obs("ten", 49, live(0, 0, 50)),
        ],
        priority: priorities({ ten: 10, twenty: 20 }),
      }),
    );
    expect(decision).toBeNull();
    expect(open[0]).toMatchObject({
      kind: "conflict",
      details: {
        winner: { sourceId: "twenty" },
        rival: { sourceId: "ten" },
        since: at(46),
      },
    });
  });

  it("does not fire between 10 and 50 with a 20 in the map (H-4)", () => {
    const { decision, open } = decide(
      input({
        current: VIGENTE,
        observations: [
          obs("twenty", 42, live(0, 0, 43)),
          obs("ten", 44, live(0, 0, 45)),
          obs("fifty", 44, live(0, 0, 45)),
          obs("fifty", 46, live(1, 0, 47)),
          obs("ten", 49, live(0, 0, 50)),
        ],
        priority: priorities({ ten: 10, twenty: 20, fifty: 50 }),
      }),
    );
    expect(decision).toMatchObject({ score: { home: 1, away: 0 } });
    expect(open).toEqual([]);
  });
});

describe("CA-6 RN-05 silence", () => {
  const VIGENTE = current(live(1, 0, 60));

  it("goes to sen_sinal and opens the alert with no observation at all", () => {
    const { decision, open, resolve } = decide(
      input({ current: VIGENTE, observations: [], now: at(20) }),
    );
    expect(decision).toMatchObject({
      status: "live",
      score: { home: 1, away: 0 },
      minute: 60,
      qualifier: "sen_sinal",
      rule: "RN-05",
    });
    expect(decision?.observationIds).toEqual(VIGENTE.observationIds);
    expect(open).toEqual([
      {
        kind: "silence",
        matchId: MATCH.id,
        details: { lastObservedAt: null },
      },
    ]);
    expect(resolve).toEqual([]);
  });

  it("writes no second row but keeps opening the alert (CA-9 dedupes)", () => {
    const { decision, open } = decide(
      input({
        current: current(live(1, 0, 60), { qualifier: "sen_sinal" }),
        observations: [],
        now: at(20),
      }),
    );
    expect(decision).toBeNull();
    expect(open).toEqual([
      {
        kind: "silence",
        matchId: MATCH.id,
        details: { lastObservedAt: null },
      },
    ]);
  });

  it("says nothing between five and fifteen minutes of quiet", () => {
    const { decision, open } = decide(
      input({
        current: VIGENTE,
        observations: [obs("ten", 13, live(1, 0, 60))],
        now: at(20),
      }),
    );
    expect(decision).toBeNull();
    expect(open).toEqual([]);
  });

  it("does not apply with no current decision, nor outside live", () => {
    expect(
      decide(input({ current: null, observations: [], now: at(20) })),
    ).toEqual({ decision: null, open: [], resolve: [] });
    expect(
      decide(
        input({ current: current(scheduled), observations: [], now: at(20) }),
      ),
    ).toEqual({ decision: null, open: [], resolve: [] });
  });

  it("resolves the silence when the signal comes back", () => {
    const { decision, open, resolve } = decide(
      input({
        current: current(live(1, 0, 60), { qualifier: "sen_sinal" }),
        observations: [obs("ten", 29, live(1, 0, 75))],
        now: at(30),
      }),
    );
    expect(decision).toMatchObject({ minute: 75, qualifier: "provisional" });
    expect(open).toEqual([]);
    expect(resolve).toEqual(["silence"]);
  });
});

describe("CA-6 RN-02 forced finish with a trace (H-3, H-5)", () => {
  const VIGENTE = current(live(1, 0, 90));

  it("closes the match and always opens a forced_finish alert", () => {
    const { decision, open, resolve } = decide(
      input({ current: VIGENTE, observations: [], now: at(121) }),
    );
    expect(decision).toMatchObject({
      status: "finished",
      score: { home: 1, away: 0 },
      minute: null,
      qualifier: "provisional",
      rule: "RN-02",
    });
    expect(decision?.observationIds).toEqual(VIGENTE.observationIds);
    expect(open).toEqual([
      {
        kind: "forced_finish",
        matchId: MATCH.id,
        details: {
          score: { home: 1, away: 0 },
          minute: 90,
          kickoff: KICKOFF,
          lastObservedAt: null,
          lastStatus: null,
        },
      },
    ]);
    // The operator closes this one, never the engine (N-3).
    expect(resolve).toEqual([]);
  });

  it("closes it even while live observations keep arriving (H-3)", () => {
    const { decision, open } = decide(
      input({
        current: VIGENTE,
        observations: [obs("ten", 119, live(1, 0, 90))],
        now: at(121),
      }),
    );
    expect(decision).toMatchObject({ status: "finished", rule: "RN-02" });
    expect(open[0]).toMatchObject({
      kind: "forced_finish",
      details: { lastObservedAt: at(119), lastStatus: "live" },
    });
  });

  it("never fires when the provider closes the match in time", () => {
    const { decision, open } = decide(
      input({
        current: VIGENTE,
        observations: [obs("ten", 95, finished(2, 1))],
        now: at(96),
      }),
    );
    expect(decision).toMatchObject({
      status: "finished",
      score: { home: 2, away: 1 },
      rule: "RN-01",
    });
    expect(open).toEqual([]);
  });

  it("does not fire once the match is already finished", () => {
    expect(
      decide(
        input({
          current: current(finished(2, 1)),
          observations: [],
          now: at(121),
        }),
      ),
    ).toEqual({ decision: null, open: [], resolve: [] });
  });
});

describe("CA-7 the derived qualifier (ADR-004)", () => {
  it("is provisional with a single provider source", () => {
    const { decision } = decide(
      input({ observations: [obs("ten", 49, live(1, 0, 50))] }),
    );
    expect(decision).toMatchObject({ qualifier: "provisional" });
    expect(decision?.observationIds).toHaveLength(1);
  });

  it("is confirmado when two sources agree, citing both (RN-06)", () => {
    const winner = obs("twenty", 49, live(1, 0, 50));
    const second = obs("ten", 48, live(1, 0, 49));
    const { decision } = decide(input({ observations: [winner, second] }));
    expect(decision).toMatchObject({ qualifier: "confirmado" });
    expect(decision?.observationIds).toEqual([winner.id, second.id]);
  });

  it("is provisional when they agree on the score but not on the state", () => {
    const winner = obs("twenty", 49, finished(1, 0));
    const { decision } = decide(
      input({ observations: [winner, obs("ten", 48, live(1, 0, 90))] }),
    );
    expect(decision).toMatchObject({
      status: "finished",
      qualifier: "provisional",
    });
    expect(decision?.observationIds).toEqual([winner.id]);
  });

  it("is confirmado with a federation source alone", () => {
    const { decision } = decide(
      input({ observations: [obs("fifty", 49, live(1, 0, 50))] }),
    );
    expect(decision).toMatchObject({ qualifier: "confirmado" });
    expect(decision?.observationIds).toHaveLength(1);
  });

  it("is confirmado for the operator", () => {
    const { decision } = decide(
      input({ observations: [obs("operator", 49, live(1, 0, 50))] }),
    );
    expect(decision).toMatchObject({ qualifier: "confirmado" });
  });

  it("never produces sen_sinal outside live, and the drafts are Decisions", () => {
    const silent = decide(
      input({
        current: current(live(1, 0, 60)),
        observations: [],
        now: at(20),
      }),
    ).decision;
    expect(silent).toMatchObject({ status: "live", qualifier: "sen_sinal" });
    expect(() =>
      Decision.parse({
        ...silent,
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        version: 2,
      }),
    ).not.toThrow();
    // The forced finish leaves live for finished, and provisional with it.
    expect(
      decide(
        input({
          current: current(live(1, 0, 90)),
          observations: [],
          now: at(121),
        }),
      ).decision,
    ).toMatchObject({ status: "finished", qualifier: "provisional" });
  });
});

describe("CA-12 decide is pure and total", () => {
  it("returns the same output for the same input", () => {
    const observations = [
      obs("ten", 48, live(1, 0, 49)),
      obs("twenty", 49, live(1, 0, 50)),
    ];
    const built = () =>
      input({ current: current(live(0, 0, 45)), observations });
    expect(decide(built())).toEqual(decide(built()));
  });

  it("answers with no observations, no decision and no match state", () => {
    expect(decide(input({}))).toEqual({
      decision: null,
      open: [],
      resolve: [],
    });
  });
});

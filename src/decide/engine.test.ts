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
const suspended = (home: number, away: number) =>
  ({ status: "suspended", score: { home, away }, minute: null }) as const;

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
    scoredBy: { home: null, away: null },
    forcedFinish: false,
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

  it("publishes postponed from a provider, provisional (ADR-012)", () => {
    const { decision } = decide(
      input({ observations: [obs("ten", 49, postponed)] }),
    );
    expect(decision).toMatchObject({
      status: "postponed",
      rule: "RN-01",
      qualifier: "provisional",
    });
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

  // SPEC-014 (ADR-011 §2): RN-03 decides side by side and holds only the side
  // that goes down without its owner; the side that goes up is published. It
  // used to hold the whole score ("never mixes sides", SPEC-007).
  it("holds only the side that goes down: 1-2 against 2-1 is 2-2 (ADR-011 §2)", () => {
    const { decision, open } = decide(
      input({
        current: vigente,
        observations: [obs("ten", 49, live(1, 2, 75))],
      }),
    );
    expect(decision).toMatchObject({
      score: { home: 2, away: 2 },
      rule: "RN-03",
    });
    expect(open).toMatchObject([{ kind: "regression" }]);
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

  it("dates the silence with lastHeard when it is older than the window (N-9)", () => {
    const { decision, open } = decide(
      input({
        current: VIGENTE,
        observations: [],
        lastHeard: { observedAt: at(-20), status: "live" },
        now: at(20),
      }),
    );
    expect(decision).toMatchObject({ qualifier: "sen_sinal", rule: "RN-05" });
    expect(open).toEqual([
      {
        kind: "silence",
        matchId: MATCH.id,
        details: { lastObservedAt: at(-20) },
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

  // Since SPEC-018 CA-4 a scheduled past kickoff + 15 does go to sen_sinal
  // (ADR-013 §2): before +15 it does not, and neither do the other states.
  it("does not apply with no current decision, nor outside live and a late scheduled", () => {
    expect(
      decide(input({ current: null, observations: [], now: at(20) })),
    ).toEqual({ decision: null, open: [], resolve: [] });
    expect(
      decide(
        input({ current: current(scheduled), observations: [], now: at(14) }),
      ),
    ).toEqual({ decision: null, open: [], resolve: [] });
    expect(
      decide(
        input({ current: current(postponed), observations: [], now: at(20) }),
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
          heldScore: { home: 1, away: 0 },
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

  it("traces it with lastHeard, however old (N-9)", () => {
    const { open } = decide(
      input({
        current: VIGENTE,
        observations: [],
        lastHeard: { observedAt: at(81), status: "live" },
        now: at(121),
      }),
    );
    expect(open).toEqual([
      {
        kind: "forced_finish",
        matchId: MATCH.id,
        details: {
          score: { home: 1, away: 0 },
          heldScore: { home: 1, away: 0 },
          minute: 90,
          kickoff: KICKOFF,
          lastObservedAt: at(81),
          lastStatus: "live",
        },
      },
    ]);
  });

  it("leaves the trace empty only when the match was never observed", () => {
    const { open } = decide(
      input({
        current: VIGENTE,
        observations: [],
        lastHeard: null,
        now: at(121),
      }),
    );
    expect(open[0]).toMatchObject({
      details: { lastObservedAt: null, lastStatus: null },
    });
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

// SPEC-012 CA-2 (ADR-010 §1): RN-03 rules while the match is in play and does
// not survive the close. The transition to finished publishes the score of the
// winning observation (RN-01), not the held one.
describe("SPEC-012 CA-2 the close publishes the winning observation", () => {
  it("(i) held 2-1 and a source finished 2-0 publishes 2-0", () => {
    const winner = obs("ten", 95, finished(2, 0));
    const { decision, open } = decide(
      input({
        current: current(live(2, 1, 90), { rule: "RN-03" }),
        observations: [winner],
        now: at(95),
      }),
    );
    expect(decision).toMatchObject({
      status: "finished",
      score: { home: 2, away: 0 },
      minute: null,
    });
    expect(decision?.rule).not.toBe("RN-03");
    expect(decision?.observationIds).toEqual([winner.id]);
    expect(open).toEqual([]);
  });

  it("(ii) forced at +120 with a fresh live 1-0 over a current 1-1 publishes 1-0", () => {
    const fresh = obs("ten", 119, live(1, 0, 90));
    const { decision, open } = decide(
      input({
        current: current(live(1, 1, 90), { rule: "RN-03" }),
        observations: [fresh],
        now: at(121),
      }),
    );
    expect(decision).toMatchObject({
      status: "finished",
      score: { home: 1, away: 0 },
      minute: null,
      rule: "RN-02",
      qualifier: "provisional",
    });
    expect(decision?.observationIds).toEqual([fresh.id]);
    expect(open).toMatchObject([{ kind: "forced_finish" }]);
  });

  it("(iii) forced with no fresh observation publishes the current and nothing else changes", () => {
    const stale = obs("ten", 110, live(1, 0, 90));
    const vigente = current(live(1, 1, 90), { rule: "RN-03" });
    const { decision } = decide(
      input({ current: vigente, observations: [stale], now: at(121) }),
    );
    expect(decision).toMatchObject({
      status: "finished",
      score: { home: 1, away: 1 },
      rule: "RN-02",
      qualifier: "provisional",
    });
    expect(decision?.observationIds).toEqual(vigente.observationIds);
  });

  it("(iv) in play a retreat still holds and opens a regression", () => {
    const retreat = obs("ten", 88, live(2, 0, 88));
    const { decision, open } = decide(
      input({
        current: current(live(2, 1, 85)),
        observations: [retreat],
        now: at(88),
      }),
    );
    expect(decision).toMatchObject({
      status: "live",
      score: { home: 2, away: 1 },
      minute: 88,
      rule: "RN-03",
    });
    expect(open).toEqual([
      {
        kind: "regression",
        matchId: MATCH.id,
        details: {
          sourceId: "ten",
          observationId: retreat.id,
          current: { home: 2, away: 1 },
          proposed: { home: 2, away: 0 },
        },
      },
    ]);
  });

  it("(v) the close does not resolve the open regression (EPIC-004)", () => {
    const byTheSource = decide(
      input({
        current: current(live(2, 1, 90), { rule: "RN-03" }),
        observations: [obs("ten", 95, finished(2, 0))],
        now: at(95),
      }),
    );
    const forced = decide(
      input({
        current: current(live(1, 1, 90), { rule: "RN-03" }),
        observations: [obs("ten", 119, live(1, 0, 90))],
        now: at(121),
      }),
    );
    expect(byTheSource.resolve).toEqual([]);
    expect(forced.resolve).toEqual([]);
    expect(
      [...byTheSource.open, ...forced.open].map((a) => a.kind),
    ).not.toContain("regression");
  });
});

// SPEC-013 CA-4 (ADR-010 §2): RN-12. A match closed provisional by the forced
// finish of RN-02 accepts the final the winning source confirms later: the
// score and the qualifier change, the status never does.
describe("SPEC-013 CA-4 RN-12 accepts the final the source confirms", () => {
  const forced = (home: number, away: number) =>
    current(finished(home, away), {
      rule: "RN-02",
      qualifier: "provisional",
      forcedFinish: true,
    });

  it("(i) forced finished 2-1 and a source finished 3-1 publishes 3-1 with RN-12", () => {
    const confirmation = obs("ten", 125, finished(3, 1));
    const { decision } = decide(
      input({
        current: forced(2, 1),
        observations: [confirmation],
        now: at(125),
      }),
    );
    expect(decision).toEqual({
      status: "finished",
      score: { home: 3, away: 1 },
      minute: null,
      matchId: MATCH.id,
      qualifier: "confirmado",
      rule: "RN-12",
      observationIds: [confirmation.id],
      decidedAt: at(125),
      scoredBy: { home: "ten", away: null },
      forcedFinish: false,
    });
  });

  it("(ii) the score goes down (3-4 → 3-3) and is published all the same", () => {
    const { decision, open } = decide(
      input({
        current: forced(3, 4),
        observations: [obs("ten", 125, finished(3, 3))],
        now: at(125),
      }),
    );
    expect(decision).toMatchObject({
      status: "finished",
      score: { home: 3, away: 3 },
      rule: "RN-12",
      qualifier: "confirmado",
    });
    expect(open).toEqual([]);
  });

  it("(iii) a live after the close neither returns to live nor publishes", () => {
    expect(
      decide(
        input({
          current: forced(2, 1),
          observations: [obs("ten", 125, live(3, 1, 90))],
          now: at(125),
        }),
      ),
    ).toEqual({ decision: null, open: [], resolve: [] });
  });

  it("(iv) a confirmed finished does not admit RN-12: nothing is published", () => {
    for (const vigente of [
      current(finished(3, 1), { rule: "RN-12", qualifier: "confirmado" }),
      current(finished(3, 1), { rule: "RN-01", qualifier: "confirmado" }),
    ])
      expect(
        decide(
          input({
            current: vigente,
            observations: [obs("ten", 125, finished(3, 2))],
            now: at(125),
          }),
        ),
      ).toEqual({ decision: null, open: [], resolve: [] });
  });

  it("(v) the open forced_finish alert stays open", () => {
    const { open, resolve } = decide(
      input({
        current: forced(2, 1),
        observations: [obs("ten", 125, finished(3, 1))],
        now: at(125),
      }),
    );
    expect(resolve).toEqual([]);
    expect(open).toEqual([]);
  });

  it("confirms the same score too: only the qualifier changes", () => {
    const { decision } = decide(
      input({
        current: forced(2, 1),
        observations: [obs("ten", 125, finished(2, 1))],
        now: at(125),
      }),
    );
    expect(decision).toMatchObject({
      status: "finished",
      score: { home: 2, away: 1 },
      rule: "RN-12",
      qualifier: "confirmado",
    });
  });
});

describe("SPEC-016 CA-2 postponed and suspended without an operator", () => {
  it("(i) publishes postponed from a provider with no Decision, no alerts", () => {
    const observation = obs("ten", 49, postponed);
    expect(decide(input({ observations: [observation] }))).toEqual({
      decision: {
        status: "postponed",
        score: null,
        minute: null,
        matchId: MATCH.id,
        qualifier: "provisional",
        rule: "RN-01",
        observationIds: [observation.id],
        decidedAt: at(50),
        scoredBy: { home: null, away: null },
        forcedFinish: false,
      },
      open: [],
      resolve: [],
    });
  });

  it("(ii) publishes suspended 1-1 over a live 1-1, provisional", () => {
    const { decision, open } = decide(
      input({
        current: current(live(1, 1, 60)),
        observations: [obs("ten", 49, suspended(1, 1))],
      }),
    );
    expect(decision).toMatchObject({
      status: "suspended",
      score: { home: 1, away: 1 },
      minute: null,
      qualifier: "provisional",
      rule: "RN-01",
    });
    expect(open).toEqual([]);
  });

  it("(iii) leaves postponed for live", () => {
    const { decision } = decide(
      input({
        current: current(postponed),
        observations: [obs("ten", 49, live(0, 0, 50))],
      }),
    );
    expect(decision).toMatchObject({
      status: "live",
      score: { home: 0, away: 0 },
      rule: "RN-01",
      qualifier: "provisional",
    });
  });

  it("(iii) leaves postponed for scheduled", () => {
    const { decision } = decide(
      input({
        current: current(postponed),
        observations: [obs("ten", 49, scheduled)],
      }),
    );
    expect(decision).toMatchObject({
      status: "scheduled",
      rule: "RN-01",
      qualifier: "provisional",
    });
  });

  it("(iii) leaves suspended for live", () => {
    const { decision } = decide(
      input({
        current: current(suspended(1, 1)),
        observations: [obs("ten", 49, live(1, 1, 70))],
      }),
    );
    expect(decision).toMatchObject({
      status: "live",
      score: { home: 1, away: 1 },
      rule: "RN-01",
      qualifier: "provisional",
    });
  });

  it("(iv) confirms postponed when a second source of priority 20 agrees", () => {
    const ten = obs("ten", 48, postponed);
    const twenty = obs("twenty", 49, postponed);
    const { decision } = decide(input({ observations: [ten, twenty] }));
    expect(decision).toMatchObject({
      status: "postponed",
      rule: "RN-01",
      qualifier: "confirmado",
      observationIds: [twenty.id, ten.id],
    });
  });

  it("(iv) confirms suspended when a second source agrees on the score", () => {
    const { decision } = decide(
      input({
        current: current(live(1, 1, 60)),
        observations: [
          obs("ten", 48, suspended(1, 1)),
          obs("twenty", 49, suspended(1, 1)),
        ],
      }),
    );
    expect(decision).toMatchObject({
      status: "suspended",
      score: { home: 1, away: 1 },
      qualifier: "confirmado",
    });
  });

  it("(iv) a federation source still confirms on its own", () => {
    const { decision } = decide(
      input({ observations: [obs("fifty", 49, postponed)] }),
    );
    expect(decision).toMatchObject({
      status: "postponed",
      rule: "RN-01",
      qualifier: "confirmado",
    });
  });

  it("(v) does not force-finish a suspended at kickoff + 120", () => {
    const vigente = current(suspended(1, 1));
    expect(
      decide(input({ current: vigente, observations: [], now: at(121) })),
    ).toEqual({ decision: null, open: [], resolve: [] });
    expect(
      decide(
        input({
          current: vigente,
          observations: [obs("ten", 120, suspended(1, 1))],
          now: at(121),
        }),
      ),
    ).toEqual({ decision: null, open: [], resolve: [] });
  });

  it("(vi) publishes nothing over a finished from a postponed", () => {
    for (const source of ["ten", "fifty"])
      expect(
        decide(
          input({
            current: current(finished(2, 1), { qualifier: "confirmado" }),
            observations: [obs(source, 49, postponed)],
          }),
        ),
      ).toEqual({ decision: null, open: [], resolve: [] });
    expect(
      decide(
        input({
          current: current(finished(2, 1)),
          observations: [obs("ten", 49, postponed)],
        }),
      ).decision,
    ).toBeNull();
  });
});

// SPEC-014 (ADR-011). In play, a side of the score goes down only by its
// owner — the source that fixed its published value — or a heavier source.
// A null owner reads as api-football, the only source that published so far.
const AF = "api-football";
const OP = "operator";
const owners = (home: string | null, away: string | null) => ({
  scoredBy: {
    home: home as SourceId | null,
    away: away as SourceId | null,
  },
});
const withProvider = (over: Partial<EngineInput>): EngineInput =>
  input({
    priority: priorities({
      [AF]: 10,
      "other-ten": 10,
      five: 5,
      twenty: 20,
      operator: 100,
    }),
    ...over,
  });

describe("SPEC-014 CA-3 the engine decides the retreat side by side", () => {
  it("(i) api-football raised 2-1 and proposes 2-0 in play: publishes 2-0, RN-01, no alert", () => {
    const retreat = obs(AF, 49, live(2, 0, 75));
    const { decision, open } = decide(
      withProvider({
        current: current(live(2, 1, 70), owners(AF, AF)),
        observations: [retreat],
      }),
    );
    expect(decision).toMatchObject({
      status: "live",
      score: { home: 2, away: 0 },
      minute: 75,
      rule: "RN-01",
    });
    expect(decision?.observationIds).toEqual([retreat.id]);
    expect(open).toEqual([]);
  });

  it("(ii) the operator raised 1-0 and api-football proposes 0-0: holds 1-0 and opens regression", () => {
    const retreat = obs(AF, 49, live(0, 0, 75));
    const { decision, open } = decide(
      withProvider({
        current: current(live(1, 0, 70), owners(OP, null)),
        observations: [retreat],
      }),
    );
    expect(decision).toMatchObject({
      status: "live",
      score: { home: 1, away: 0 },
      minute: 75,
      rule: "RN-03",
    });
    expect(open).toEqual([
      {
        kind: "regression",
        matchId: MATCH.id,
        details: {
          sourceId: AF,
          observationId: retreat.id,
          current: { home: 1, away: 0 },
          proposed: { home: 0, away: 0 },
        },
      },
    ]);
  });

  it("(iii) home by the operator, away by api-football, 0-0 from 1-1: publishes 1-0, RN-03, with alert", () => {
    const { decision, open } = decide(
      withProvider({
        current: current(live(1, 1, 70), owners(OP, AF)),
        observations: [obs(AF, 49, live(0, 0, 75))],
      }),
    );
    expect(decision).toMatchObject({
      status: "live",
      score: { home: 1, away: 0 },
      rule: "RN-03",
    });
    expect(open).toMatchObject([
      {
        kind: "regression",
        details: {
          current: { home: 1, away: 1 },
          proposed: { home: 0, away: 0 },
        },
      },
    ]);
  });

  it("(iv) a second source of equal or lower priority than the owner proposes less: holds and alerts", () => {
    for (const source of ["other-ten", "five"]) {
      const { decision, open } = decide(
        withProvider({
          current: current(live(2, 1, 70), owners(AF, AF)),
          observations: [obs(source, 49, live(2, 0, 75))],
        }),
      );
      expect(decision).toMatchObject({
        score: { home: 2, away: 1 },
        rule: "RN-03",
      });
      expect(open).toMatchObject([
        { kind: "regression", details: { sourceId: source } },
      ]);
    }
  });

  it("(v) a null owner is api-football: it may withdraw it, a heavier source too, an equal one not", () => {
    const vigente = current(live(2, 1, 70), owners(null, null));
    const by = (source: string) =>
      decide(
        withProvider({
          current: vigente,
          observations: [obs(source, 49, live(2, 0, 75))],
        }),
      );
    expect(by(AF).decision).toMatchObject({
      score: { home: 2, away: 0 },
      rule: "RN-01",
    });
    expect(by(AF).open).toEqual([]);
    expect(by("twenty").decision).toMatchObject({
      score: { home: 2, away: 0 },
      rule: "RN-01",
    });
    expect(by("other-ten").decision).toMatchObject({
      score: { home: 2, away: 1 },
      rule: "RN-03",
    });
  });

  it("a heavier source lowers a side another source raised", () => {
    const { decision, open } = decide(
      withProvider({
        current: current(live(1, 0, 70), owners(AF, null)),
        observations: [obs("twenty", 49, live(0, 0, 75))],
      }),
    );
    expect(decision).toMatchObject({
      score: { home: 0, away: 0 },
      rule: "RN-01",
    });
    expect(open).toEqual([]);
  });

  it("holds one side and lets the other grow: 1-1 (operator, any) against 0-2 is 1-2", () => {
    const { decision } = decide(
      withProvider({
        current: current(live(1, 1, 70), owners(OP, AF)),
        observations: [obs(AF, 49, live(0, 2, 75))],
      }),
    );
    expect(decision).toMatchObject({
      score: { home: 1, away: 2 },
      rule: "RN-03",
    });
    expect(decision?.scoredBy).toEqual({ home: OP, away: AF });
  });
});

describe("SPEC-014 CA-4 the owner is recorded", () => {
  it("a side that goes up takes the winning source; the other keeps its own", () => {
    const { decision } = decide(
      withProvider({
        current: current(live(0, 0, 10), owners(AF, OP)),
        observations: [obs("twenty", 49, live(1, 0, 50))],
      }),
    );
    expect(decision?.scoredBy).toEqual({ home: "twenty", away: OP });
  });

  it("a side that goes down takes the winning source; the other keeps its own", () => {
    const { decision } = decide(
      withProvider({
        current: current(live(2, 1, 70), owners("twenty", null)),
        observations: [obs(AF, 49, live(2, 0, 75))],
      }),
    );
    expect(decision).toMatchObject({
      score: { home: 2, away: 0 },
      rule: "RN-01",
    });
    expect(decision?.scoredBy).toEqual({ home: "twenty", away: AF });
  });

  it("a first score takes the winner on both sides", () => {
    const { decision } = decide(
      withProvider({ observations: [obs(AF, 49, live(0, 0, 3))] }),
    );
    expect(decision?.scoredBy).toEqual({ home: AF, away: AF });
  });

  it("a retention keeps the owner of the held side", () => {
    const { decision } = decide(
      withProvider({
        current: current(live(1, 1, 70), owners(OP, AF)),
        observations: [obs(AF, 49, live(0, 0, 75))],
      }),
    );
    expect(decision?.scoredBy).toEqual({ home: OP, away: AF });
  });

  it("a score that does not move keeps both owners (minute, silence, forced finish)", () => {
    const vigente = current(live(1, 1, 60), owners(OP, "twenty"));
    const minute = decide(
      withProvider({
        current: vigente,
        observations: [obs(AF, 49, live(1, 1, 61))],
      }),
    ).decision;
    const silence = decide(
      withProvider({ current: vigente, observations: [], now: at(80) }),
    ).decision;
    const forced = decide(
      withProvider({
        current: current(live(1, 1, 90), owners(OP, "twenty")),
        observations: [],
        now: at(121),
      }),
    ).decision;
    for (const d of [minute, silence, forced])
      expect(d?.scoredBy).toEqual({ home: OP, away: "twenty" });
  });

  it("a null score carries null owners", () => {
    const postponedNow = decide(
      withProvider({
        current: current(live(1, 0, 20), owners(AF, AF)),
        observations: [obs(AF, 49, postponed)],
      }),
    ).decision;
    const first = decide(
      withProvider({ observations: [obs(AF, 49, scheduled)] }),
    ).decision;
    expect(postponedNow).toMatchObject({ status: "postponed", score: null });
    expect(postponedNow?.scoredBy).toEqual({ home: null, away: null });
    expect(first?.scoredBy).toEqual({ home: null, away: null });
  });

  it("the operator owns what it changes", () => {
    const { decision } = decide(
      withProvider({
        current: current(live(2, 1, 70), owners(AF, AF)),
        observations: [obs(OP, 49, live(2, 0, 75))],
      }),
    );
    expect(decision?.scoredBy).toEqual({ home: AF, away: OP });
  });

  it("RN-12 gives the changed side to the confirming source", () => {
    const { decision } = decide(
      withProvider({
        current: current(finished(2, 1), {
          rule: "RN-02",
          forcedFinish: true,
          ...owners(OP, AF),
        }),
        observations: [obs("twenty", 125, finished(3, 1))],
        now: at(125),
      }),
    );
    expect(decision).toMatchObject({ rule: "RN-12" });
    expect(decision?.scoredBy).toEqual({ home: "twenty", away: AF });
  });
});

describe("SPEC-014 CA-8 the forced finish carries its own mark", () => {
  it("the forced finish comes out with true, with or without a fresh observation", () => {
    const vigente = current(live(1, 1, 90));
    for (const observations of [[], [obs(AF, 119, live(1, 0, 90))]])
      expect(
        decide(withProvider({ current: vigente, observations, now: at(121) }))
          .decision,
      ).toMatchObject({ rule: "RN-02", forcedFinish: true });
  });

  it("RN-01, RN-03, RN-05, RN-12 and the operator come out with false", () => {
    const rn01 = decide(
      withProvider({ observations: [obs(AF, 49, live(0, 0, 3))] }),
    );
    const rn03 = decide(
      withProvider({
        current: current(live(1, 0, 40), owners(OP, null)),
        observations: [obs(AF, 49, live(0, 0, 50))],
      }),
    );
    const rn05 = decide(
      withProvider({
        current: current(live(1, 0, 40)),
        observations: [],
        now: at(60),
      }),
    );
    const rn12 = decide(
      withProvider({
        current: current(finished(1, 0), { rule: "RN-02", forcedFinish: true }),
        observations: [obs(AF, 125, finished(2, 0))],
        now: at(125),
      }),
    );
    const operator = decide(
      withProvider({ observations: [obs(OP, 49, live(0, 0, 3))] }),
    );
    expect(
      [rn01, rn03, rn05, rn12, operator].map((o) => [
        o.decision?.rule,
        o.decision?.forcedFinish,
      ]),
    ).toEqual([
      ["RN-01", false],
      ["RN-03", false],
      ["RN-05", false],
      ["RN-12", false],
      ["operator", false],
    ]);
  });

  it("a finished RN-02 with the mark false or null plus a finished observation never publishes RN-12", () => {
    for (const forcedFinish of [false, null])
      expect(
        decide(
          withProvider({
            current: current(finished(2, 1), { rule: "RN-02", forcedFinish }),
            observations: [obs(AF, 125, finished(3, 1))],
            now: at(125),
          }),
        ).decision?.rule,
      ).not.toBe("RN-12");
  });
});

describe("SPEC-014 CA-9 a confirmed finished has a single reading", () => {
  it("(i) a finished RN-01 provisional without mark plus a higher finished is RN-01, never RN-12", () => {
    const { decision } = decide(
      withProvider({
        current: current(finished(1, 0), { rule: "RN-01", forcedFinish: null }),
        observations: [obs(AF, 125, finished(2, 0))],
        now: at(125),
      }),
    );
    expect(decision).toMatchObject({
      status: "finished",
      score: { home: 2, away: 0 },
      rule: "RN-01",
    });
  });

  it("(ii) a finished RN-12 confirmado plus a different finished publishes nothing", () => {
    expect(
      decide(
        withProvider({
          current: current(finished(3, 1), {
            rule: "RN-12",
            qualifier: "confirmado",
          }),
          observations: [obs(AF, 130, finished(3, 2))],
          now: at(130),
        }),
      ),
    ).toEqual({ decision: null, open: [], resolve: [] });
  });
});

describe("SPEC-014 CA-10 the forced_finish alert tells what it publishes", () => {
  it("current 1-1 and a fresh live 1-0: score 1-0, heldScore 1-1", () => {
    const { open } = decide(
      withProvider({
        current: current(live(1, 1, 90)),
        observations: [obs(AF, 119, live(1, 0, 90))],
        now: at(121),
      }),
    );
    expect(open).toMatchObject([
      {
        kind: "forced_finish",
        details: {
          score: { home: 1, away: 0 },
          heldScore: { home: 1, away: 1 },
        },
      },
    ]);
  });

  it("with no fresh observation both are the current one", () => {
    const { open } = decide(
      withProvider({
        current: current(live(1, 1, 90)),
        observations: [obs(AF, 110, live(1, 0, 90))],
        now: at(121),
      }),
    );
    expect(open).toMatchObject([
      {
        kind: "forced_finish",
        details: {
          score: { home: 1, away: 1 },
          heldScore: { home: 1, away: 1 },
        },
      },
    ]);
  });
});

// SPEC-018 CA-4 (ADR-013 §2, RN-05): a scheduled match whose kickoff is 15
// minutes gone, with no fresh observation that gives it live, finished,
// postponed or suspended, goes to scheduled · sen_sinal, RN-05, citing the
// current observations and opening no Alert (H-4). Nothing new comes out of
// it but a real state: live, finished, postponed or suspended.
describe("SPEC-018 CA-4 sen_sinal in scheduled", () => {
  const VIGENTE = current(scheduled);

  it("(i) at +14 nothing happens", () => {
    expect(
      decide(
        input({
          current: VIGENTE,
          observations: [obs("ten", 13, scheduled)],
          now: at(14),
        }),
      ),
    ).toEqual({ decision: null, open: [], resolve: [] });
  });

  it("(ii) at +15 with scheduled observations it goes to sen_sinal with no alert", () => {
    const { decision, open, resolve } = decide(
      input({
        current: VIGENTE,
        observations: [obs("ten", 14, scheduled)],
        now: at(15),
      }),
    );
    expect(decision).toMatchObject({
      status: "scheduled",
      score: null,
      minute: null,
      qualifier: "sen_sinal",
      rule: "RN-05",
      forcedFinish: false,
    });
    expect(decision?.observationIds).toEqual(VIGENTE.observationIds);
    expect(open).toEqual([]);
    expect(resolve).toEqual([]);
    expect(() =>
      Decision.parse({
        ...decision,
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        version: 2,
      }),
    ).not.toThrow();
  });

  it("(ii) also with no observation at all", () => {
    const { decision, open } = decide(
      input({ current: VIGENTE, observations: [], now: at(40) }),
    );
    expect(decision).toMatchObject({
      status: "scheduled",
      qualifier: "sen_sinal",
      rule: "RN-05",
    });
    expect(open).toEqual([]);
  });

  it("(iii) a later scheduled observation does not take sen_sinal away", () => {
    const silent = current(scheduled, {
      qualifier: "sen_sinal",
      rule: "RN-05",
    });
    for (const minutes of [16, 60, 200, 359])
      expect(
        decide(
          input({
            current: silent,
            observations: [obs("ten", minutes - 1, scheduled)],
            now: at(minutes),
          }),
        ),
      ).toEqual({ decision: null, open: [], resolve: [] });
  });

  it("(iv) a finished arriving gives finished provisional RN-01", () => {
    const final = obs("ten", 229, finished(3, 1));
    const { decision, open } = decide(
      input({
        current: current(scheduled, { qualifier: "sen_sinal", rule: "RN-05" }),
        observations: [obs("ten", 200, scheduled), final],
        now: at(230),
      }),
    );
    expect(decision).toMatchObject({
      status: "finished",
      score: { home: 3, away: 1 },
      qualifier: "provisional",
      rule: "RN-01",
      forcedFinish: false,
    });
    expect(decision?.observationIds).toEqual([final.id]);
    expect(open).toEqual([]);
  });

  it("(v) a live arriving gives live with its normal qualifier, and in live RN-05 opens its alert as today", () => {
    const { decision, open } = decide(
      input({
        current: current(scheduled, { qualifier: "sen_sinal", rule: "RN-05" }),
        observations: [obs("ten", 29, live(0, 0, 29))],
        now: at(30),
      }),
    );
    expect(decision).toMatchObject({
      status: "live",
      qualifier: "provisional",
      rule: "RN-01",
    });
    expect(open).toEqual([]);

    const quiet = decide(
      input({
        current: current(live(0, 0, 29)),
        observations: [],
        now: at(60),
      }),
    );
    expect(quiet.decision).toMatchObject({
      status: "live",
      qualifier: "sen_sinal",
      rule: "RN-05",
    });
    expect(quiet.open.map((a) => a.kind)).toEqual(["silence"]);
  });

  it("(v) a fresh live from a lesser source is enough to keep it out of sen_sinal", () => {
    const { decision } = decide(
      input({
        current: VIGENTE,
        observations: [
          obs("twenty", 19, scheduled),
          obs("ten", 19, live(0, 0, 19)),
        ],
        now: at(20),
      }),
    );
    expect(decision).toBeNull();
  });

  it("(vi) a current postponed: nothing", () => {
    expect(
      decide(
        input({
          current: current(postponed),
          observations: [obs("ten", 19, postponed)],
          now: at(20),
        }),
      ),
    ).toEqual({ decision: null, open: [], resolve: [] });
  });

  // N-4 (F-SPEC-018-6): a late live in the extension, with no change in
  // engine.ts. RN-02 and ADR-009 §4 close it at once with its alert, the
  // window keeps it (CA-2) and RN-12 publishes the FT of the source.
  it("(vii) late live at +200: live RN-01, forced finish RN-02 in the sweep, RN-12 at +230", () => {
    const silent = current(scheduled, {
      qualifier: "sen_sinal",
      rule: "RN-05",
    });
    const late = obs("ten", 199, live(1, 0, 70));
    const first = decide(
      input({ current: silent, observations: [late], now: at(200) }),
    );
    expect(first.decision).toMatchObject({
      status: "live",
      score: { home: 1, away: 0 },
      qualifier: "provisional",
      rule: "RN-01",
      forcedFinish: false,
    });
    expect(first.open).toEqual([]);

    const vigenteLive = {
      ...first.decision,
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" as DecisionId,
      version: 2,
    } as Decision;
    const sweep = decide(
      input({ current: vigenteLive, observations: [], now: at(200) }),
    );
    expect(sweep.decision).toMatchObject({
      status: "finished",
      score: { home: 1, away: 0 },
      qualifier: "provisional",
      rule: "RN-02",
      forcedFinish: true,
      decidedAt: at(200),
    });
    expect(sweep.open.map((a) => a.kind)).toEqual(["forced_finish"]);

    const vigenteForced = {
      ...sweep.decision,
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" as DecisionId,
      version: 3,
    } as Decision;
    const ft = obs("ten", 229, finished(2, 1));
    const confirmed = decide(
      input({ current: vigenteForced, observations: [ft], now: at(230) }),
    );
    expect(confirmed.decision).toMatchObject({
      status: "finished",
      score: { home: 2, away: 1 },
      qualifier: "confirmado",
      rule: "RN-12",
      forcedFinish: false,
    });
    expect(confirmed.decision?.observationIds).toEqual([ft.id]);
    expect(confirmed.open).toEqual([]);
  });
});

// SPEC-021 CA-3: half-time is a moment inside live and part of the published
// tuple; an absent halfTime is false (N-2).
describe("SPEC-021 CA-3 half-time in the published tuple", () => {
  const ht = (home: number, away: number, minute: number | null = 45) =>
    ({ ...live(home, away, minute), halfTime: true }) as const;
  const notHt = (home: number, away: number, minute: number | null = 45) =>
    ({ ...live(home, away, minute), halfTime: false }) as const;

  it("publishes when half-time starts and when it ends", () => {
    const starts = decide(
      input({
        current: current(notHt(1, 0)),
        observations: [obs("ten", 49, ht(1, 0))],
      }),
    ).decision;
    expect(starts).toMatchObject({
      status: "live",
      minute: 45,
      halfTime: true,
      rule: "RN-01",
    });
    const ends = decide(
      input({
        current: current(ht(1, 0)),
        observations: [obs("ten", 49, notHt(1, 0))],
      }),
    ).decision;
    expect(ends).toMatchObject({ status: "live", halfTime: false });
  });

  it("publishes nothing for equal observations inside half-time", () => {
    expect(
      decide(
        input({
          current: current(ht(1, 0)),
          observations: [obs("ten", 49, ht(1, 0))],
        }),
      ).decision,
    ).toBeNull();
  });

  it("live without halfTime and live with false are the same tuple", () => {
    expect(
      decide(
        input({
          current: current(live(1, 0, 45)),
          observations: [obs("ten", 49, notHt(1, 0))],
        }),
      ).decision,
    ).toBeNull();
    expect(
      decide(
        input({
          current: current(notHt(1, 0)),
          observations: [obs("ten", 49, live(1, 0, 45))],
        }),
      ).decision,
    ).toBeNull();
  });

  it("every live Decision carries halfTime explicitly", () => {
    const { decision } = decide(
      input({ observations: [obs("ten", 49, live(1, 0, 30))] }),
    );
    expect(decision).toMatchObject({ status: "live", halfTime: false });
  });

  it("fifteen minutes of silence in half-time publishes RN-05 sen_sinal keeping halfTime", () => {
    const { decision, open } = decide(
      input({ current: current(ht(1, 0)), observations: [], now: at(20) }),
    );
    expect(decision).toMatchObject({
      status: "live",
      score: { home: 1, away: 0 },
      minute: 45,
      halfTime: true,
      qualifier: "sen_sinal",
      rule: "RN-05",
    });
    expect(open.map((a) => a.kind)).toEqual(["silence"]);
  });

  it("RN-03 holds the score without touching halfTime", () => {
    const { decision } = decide(
      input({
        current: current(notHt(2, 0), {
          scoredBy: {
            home: "fifty" as SourceId,
            away: "fifty" as SourceId,
          },
        }),
        observations: [obs("ten", 49, ht(1, 0))],
      }),
    );
    expect(decision).toMatchObject({
      rule: "RN-03",
      score: { home: 2, away: 0 },
      halfTime: true,
    });
  });

  it("no Decision outside live carries halfTime: forced finish, finished, suspended", () => {
    const forced = decide(
      input({
        current: current(ht(1, 0)),
        observations: [obs("ten", 120, ht(1, 0))],
        now: at(121),
      }),
    ).decision;
    expect(forced).toMatchObject({ status: "finished", rule: "RN-02" });
    expect(forced).not.toHaveProperty("halfTime");
    for (const state of [finished(1, 0), suspended(1, 0)]) {
      const d = decide(
        input({
          current: current(ht(1, 0)),
          observations: [obs("ten", 49, state)],
        }),
      ).decision;
      expect(d).toMatchObject({ status: state.status });
      expect(d).not.toHaveProperty("halfTime");
    }
  });
});

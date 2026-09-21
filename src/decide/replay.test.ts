import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AliasFile,
  type CompetitionId,
  type Instant,
  type MatchId,
  type MatchState,
  MINUTE_MS,
  type Observation,
  type ObservationId,
  type RawCapture,
  type SourceId,
  shiftInstant,
} from "../model/index.ts";
import { createApiFootballResults } from "../sources/api-football/results.ts";
import { replay } from "./replay.ts";
import type { EngineMatch } from "./types.ts";

const KICKOFF = "2026-09-25T18:30:00.000Z" as Instant;
const MATCH: EngineMatch = {
  id: "primera-division-2026-27-j6-celta-deportivo" as MatchId,
  competitionId: "primera-division" as CompetitionId,
  kickoff: KICKOFF,
};
const at = (minutes: number): Instant =>
  shiftInstant(KICKOFF, minutes * MINUTE_MS);
const PROVIDER = () => 10;

const observation = (
  matchId: MatchId,
  minutes: number,
  state: MatchState,
): Observation =>
  ({
    ...state,
    id: `00000000-0000-4000-8000-${String(minutes + 1000).padStart(12, "0")}` as ObservationId,
    matchId,
    sourceId: "api-football" as SourceId,
    observedAt: at(minutes),
    receivedAt: at(minutes),
    rawRef: "raw/2026-09-25/api-football/x.json.gz",
  }) as Observation;

const live = (home: number, away: number, minute: number) =>
  ({
    status: "live",
    score: { home, away },
    minute,
    addedMinute: null,
  }) as const;
const finished = (home: number, away: number) =>
  ({ status: "finished", score: { home, away }, minute: null }) as const;

const SCRIPT = [
  observation(MATCH.id, 1, live(0, 0, 1)),
  observation(MATCH.id, 20, live(1, 0, 20)),
  observation(MATCH.id, 60, live(1, 1, 60)),
  observation(MATCH.id, 95, finished(2, 1)),
];

const published = (steps: ReturnType<typeof replay>) =>
  steps
    .filter((s) => s.output.decision !== null)
    .map((s) => ({
      now: s.now,
      status: s.output.decision?.status,
      score: s.output.decision?.score,
      rule: s.output.decision?.rule,
      qualifier: s.output.decision?.qualifier,
    }));

describe("CA-8 replay of a scripted match", () => {
  it("folds the observations into the expected log of decisions", () => {
    const steps = replay({
      match: MATCH,
      priority: PROVIDER,
      observations: SCRIPT,
    });
    expect(steps.map((s) => s.now)).toEqual([at(1), at(20), at(60), at(95)]);
    expect(published(steps)).toEqual([
      {
        now: at(1),
        status: "live",
        score: { home: 0, away: 0 },
        rule: "RN-01",
        qualifier: "provisional",
      },
      {
        now: at(20),
        status: "live",
        score: { home: 1, away: 0 },
        rule: "RN-01",
        qualifier: "provisional",
      },
      {
        now: at(60),
        status: "live",
        score: { home: 1, away: 1 },
        rule: "RN-01",
        qualifier: "provisional",
      },
      {
        now: at(95),
        status: "finished",
        score: { home: 2, away: 1 },
        rule: "RN-01",
        qualifier: "provisional",
      },
    ]);
  });

  it("is deterministic: the same input twice gives the same log", () => {
    const once = replay({
      match: MATCH,
      priority: PROVIDER,
      observations: SCRIPT,
    });
    const twice = replay({
      match: MATCH,
      priority: PROVIDER,
      observations: SCRIPT,
    });
    expect(once).toEqual(twice);
  });

  it("sorts its input: a shuffled script gives the same log", () => {
    const shuffled = [SCRIPT[2], SCRIPT[0], SCRIPT[3], SCRIPT[1]];
    expect(
      replay({ match: MATCH, priority: PROVIDER, observations: shuffled }),
    ).toEqual(
      replay({ match: MATCH, priority: PROVIDER, observations: SCRIPT }),
    );
  });

  it("inserts the sen_sinal decision in a twenty minute gap (RN-05)", () => {
    const steps = replay({
      match: MATCH,
      priority: PROVIDER,
      observations: [
        observation(MATCH.id, 1, live(0, 0, 1)),
        observation(MATCH.id, 40, live(1, 0, 40)),
      ],
      instants: [at(21)],
    });
    expect(published(steps)).toMatchObject([
      { now: at(1), rule: "RN-01", qualifier: "provisional" },
      { now: at(21), rule: "RN-05", qualifier: "sen_sinal" },
      { now: at(40), rule: "RN-01", qualifier: "provisional" },
    ]);
    expect(steps[1].output.open).toEqual([
      {
        kind: "silence",
        matchId: MATCH.id,
        details: { lastObservedAt: at(1) },
      },
    ]);
    expect(steps[2].output.resolve).toEqual(["silence"]);
  });

  it("inserts the forced finish when nobody closes the match (RN-02)", () => {
    const steps = replay({
      match: MATCH,
      priority: PROVIDER,
      observations: [
        observation(MATCH.id, 1, live(0, 0, 1)),
        observation(MATCH.id, 100, live(1, 0, 100)),
      ],
      instants: [at(121)],
    });
    const last = steps[steps.length - 1];
    expect(last.output.decision).toMatchObject({
      status: "finished",
      score: { home: 1, away: 0 },
      rule: "RN-02",
      qualifier: "provisional",
    });
    expect(last.output.open).toEqual([
      {
        kind: "forced_finish",
        matchId: MATCH.id,
        details: {
          score: { home: 1, away: 0 },
          minute: 100,
          kickoff: KICKOFF,
          lastObservedAt: at(100),
          lastStatus: "live",
        },
      },
    ]);
  });
});

// The real bodies of the provider, parsed by the real adapter: the engine
// never sees the provider, only Observations (N-2).
const aliases = AliasFile.parse(
  JSON.parse(
    readFileSync(
      new URL("../../data/alias/2026-27/api-football.json", import.meta.url),
      "utf8",
    ),
  ),
);
const adapter = createApiFootballResults({ aliases, apiKey: "unused" });
const capture: RawCapture = {
  sourceId: "api-football" as SourceId,
  capturedAt: KICKOFF,
  requests: [
    {
      url: "https://v3.football.api-sports.io/fixtures?ids=1569926",
      status: 200,
      contentType: "application/json",
      body: readFileSync(
        new URL(
          "../sources/api-football/fixtures/ids-2026-09-21.json",
          import.meta.url,
        ),
        "utf8",
      ),
    },
  ],
};
const parsed = adapter.parse(capture);
const ended = parsed.observations.filter((o) => o.status === "finished");

describe("CA-8 replay over the real parse of a provider capture", () => {
  it("has finished fixtures of the five competitions in the capture", () => {
    expect(ended.length).toBeGreaterThan(0);
    expect(
      new Set(ended.map((o) => o.matchId.split("-2026-27-")[0])).size,
    ).toBe(5);
  });

  it.each(ended.map((o) => [o.matchId, o]))(
    "closes %s with the provider score",
    (_id, o) => {
      const matchId = o.matchId as MatchId;
      const steps = replay({
        match: {
          id: matchId,
          competitionId: matchId.split("-2026-27-")[0] as CompetitionId,
          kickoff: KICKOFF,
        },
        priority: PROVIDER,
        observations: [observation(matchId, 110, o as unknown as MatchState)],
      });
      expect(steps).toHaveLength(1);
      expect(steps[0].output.decision).toMatchObject({
        matchId,
        status: "finished",
        score: o.score,
        rule: "RN-01",
        qualifier: "provisional",
      });
      expect(steps[0].output.open).toEqual([]);
    },
  );
});

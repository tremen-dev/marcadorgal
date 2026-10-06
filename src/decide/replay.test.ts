import { readFileSync } from "node:fs";
import { brotliDecompressSync } from "node:zlib";
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
import { decide as decideAt0a40046 } from "./fixtures/engine-0a40046.ts";
import { decide as decideAt11a7159 } from "./fixtures/engine-11a7159.ts";
import { decide as decideAt812c805 } from "./fixtures/engine-812c805.ts";
import {
  SABADELL_ANDORRA,
  sabadellAndorra,
} from "./fixtures/sabadell-andorra-2026-10-03.ts";
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
          heldScore: { home: 1, away: 0 },
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

// SPEC-012 CA-3. The real log of girona-albacete (2026-09-25): the 247 raw
// captures of its window, byte for byte as the raw store kept them, parsed by
// the real adapter. The source blinks a 2-1 at 19:45 and retracts it a minute
// later, then closes 2-0 itself. The same log through the engine that ran the
// measured matchday (812c805, before ADR-010 §1) and through the engine of
// today. Fixture on disk, never the network nor the database.
const GIRONA_CAPTURES: RawCapture[] = JSON.parse(
  brotliDecompressSync(
    readFileSync(
      new URL(
        "../sources/api-football/fixtures/girona-albacete-2026-09-25.json.br",
        import.meta.url,
      ),
    ),
  ).toString("utf8"),
);
const GIRONA_KICKOFF = "2026-09-25T18:30:00.000Z" as Instant;
const girona = GIRONA_CAPTURES.flatMap((raw, i) =>
  adapter.parse(raw).observations.map(
    (o) =>
      ({
        ...o,
        id: `00000000-0000-4000-9000-${String(i).padStart(12, "0")}` as ObservationId,
        sourceId: raw.sourceId,
        observedAt: o.observedAt ?? raw.capturedAt,
        receivedAt: raw.capturedAt,
        rawRef: `fixture/girona-albacete-2026-09-25.json.br#${i}`,
      }) as Observation,
  ),
);
const GIRONA: EngineMatch = {
  id: girona[0]?.matchId as MatchId,
  competitionId: "segunda-division" as CompetitionId,
  kickoff: GIRONA_KICKOFF,
};

describe("SPEC-012 CA-3 the replay of girona-albacete across ADR-010 §1", () => {
  const last = (steps: ReturnType<typeof replay>) => published(steps).at(-1);

  it("parses the 247 real captures into one observation each", () => {
    expect(GIRONA_CAPTURES).toHaveLength(247);
    expect(girona).toHaveLength(247);
    expect(new Set(girona.map((o) => o.matchId))).toEqual(
      new Set(["segunda-division-2026-27-j7-girona-albacete"]),
    );
    const scores = girona
      .filter((o) => o.status === "live" || o.status === "finished")
      .map((o) => `${o.status} ${o.score.home}-${o.score.away}`);
    expect(scores).toContain("live 2-1");
    expect(scores.at(-1)).toBe("finished 2-0");
  });

  it("ends finished 2-1 with the engine of the matchday", () => {
    const steps = replay({
      match: GIRONA,
      priority: PROVIDER,
      observations: girona,
      engine: decideAt812c805,
    });
    expect(last(steps)).toMatchObject({
      status: "finished",
      score: { home: 2, away: 1 },
      rule: "RN-03",
    });
  });

  it("ends finished 2-0 with the engine of today", () => {
    const steps = replay({
      match: GIRONA,
      priority: PROVIDER,
      observations: girona,
    });
    expect(last(steps)).toMatchObject({
      status: "finished",
      score: { home: 2, away: 0 },
      rule: "RN-01",
    });
  });
});

describe("SPEC-016 CA-3 the replay of sabadell-andorra across ADR-012", () => {
  const decisions = (steps: ReturnType<typeof replay>) =>
    steps.flatMap((s) =>
      s.output.decision === null ? [] : [s.output.decision],
    );

  it("holds the 319 real rows, all postponed from the provider", () => {
    expect(sabadellAndorra).toHaveLength(319);
    expect(new Set(sabadellAndorra.map((o) => o.id)).size).toBe(319);
    expect(new Set(sabadellAndorra.map((o) => o.status))).toEqual(
      new Set(["postponed"]),
    );
    expect(new Set(sabadellAndorra.map((o) => o.sourceId))).toEqual(
      new Set(["api-football"]),
    );
    expect(sabadellAndorra[0].observedAt).toBe("2026-10-03T16:20:25.643Z");
    expect(sabadellAndorra.at(-1)?.observedAt).toBe("2026-10-03T18:59:34.721Z");
  });

  it("publishes nothing with the engine of main", () => {
    const steps = replay({
      match: SABADELL_ANDORRA,
      priority: PROVIDER,
      observations: sabadellAndorra,
      engine: decideAt0a40046,
    });
    expect(steps).toHaveLength(319);
    expect(decisions(steps)).toEqual([]);
  });

  it("publishes one postponed provisional with the engine of today", () => {
    const steps = replay({
      match: SABADELL_ANDORRA,
      priority: PROVIDER,
      observations: sabadellAndorra,
    });
    expect(decisions(steps)).toEqual([
      {
        matchId: SABADELL_ANDORRA.id,
        status: "postponed",
        score: null,
        minute: null,
        qualifier: "provisional",
        rule: "RN-01",
        observationIds: [sabadellAndorra[0].id],
        decidedAt: "2026-10-03T16:20:25.643Z",
        scoredBy: { home: null, away: null },
        forcedFinish: false,
      },
    ]);
    expect(steps.flatMap((s) => s.output.open)).toEqual([]);
  });
});

// SPEC-014 CA-5 (ADR-011). The same real log of girona-albacete: the source
// raised 2-1 and withdrew it itself at 19:46:04Z. With the engine of main
// (11a7159) RN-03 holds the 2-1 in play until the close; with the engine of
// ADR-011 the source that raised the goal lowers it, so 2-0 is published from
// that tick on.
describe("SPEC-014 CA-5 the replay of girona-albacete across ADR-011", () => {
  const RETREAT = "2026-09-25T19:46:04.616Z";
  const liveFrom = (steps: ReturnType<typeof replay>) =>
    published(steps).filter(
      (d) => d.status === "live" && Date.parse(d.now) >= Date.parse(RETREAT),
    );
  // The published score at every instant from the retreat to the close.
  const scoreAt = (steps: ReturnType<typeof replay>) => {
    let score = "";
    const seen: string[] = [];
    for (const s of steps) {
      const d = s.output.decision;
      if (d !== null && d.score !== null)
        score = `${d.status} ${d.score.home}-${d.score.away}`;
      if (Date.parse(s.now) >= Date.parse(RETREAT) && score.startsWith("live"))
        seen.push(score);
    }
    return new Set(seen);
  };

  it("publishes live 2-1 from 19:46:04Z to the close with the engine of main", () => {
    const steps = replay({
      match: GIRONA,
      priority: PROVIDER,
      observations: girona,
      engine: decideAt11a7159,
    });
    expect(scoreAt(steps)).toEqual(new Set(["live 2-1"]));
    expect(liveFrom(steps)[0]).toMatchObject({
      now: RETREAT,
      score: { home: 2, away: 1 },
      rule: "RN-03",
    });
  });

  it("publishes live 2-0 from 19:46:04Z with the engine of ADR-011", () => {
    const steps = replay({
      match: GIRONA,
      priority: PROVIDER,
      observations: girona,
    });
    expect(scoreAt(steps)).toEqual(new Set(["live 2-0"]));
    expect(liveFrom(steps)[0]).toMatchObject({
      now: RETREAT,
      score: { home: 2, away: 0 },
      rule: "RN-01",
    });
    expect(
      steps
        .filter((s) => Date.parse(s.now) >= Date.parse(RETREAT))
        .flatMap((s) => s.output.open.map((a) => a.kind)),
    ).not.toContain("regression");
  });
});

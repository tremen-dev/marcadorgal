import { describe, expect, it } from "vitest";
import { decide as decideAt11a7159 } from "../decide/fixtures/engine-11a7159.ts";
import {
  type CompetitionId,
  type Instant,
  type MatchId,
  type MatchState,
  MINUTE_MS,
  type Observation,
  type ObservationId,
  type SourceId,
  shiftInstant,
} from "../model/index.ts";
import { replayJornada, sweepInstants } from "./replay-jornada.ts";

// SPEC-012 CA-4, the pure half: replay each match of the window with the
// engine of today, compare with board and draft one corrective Decision per
// divergent match. The database half is replay-jornada-db.ts.

const KICKOFF = "2026-09-25T18:30:00.000Z" as Instant;
const TODAY = "2026-09-29T10:00:00.000Z" as Instant;
const at = (minutes: number): Instant =>
  shiftInstant(KICKOFF, minutes * MINUTE_MS);

const match = (slug: string) => ({
  id: `segunda-division-2026-27-j7-${slug}` as MatchId,
  competitionId: "segunda-division" as CompetitionId,
  kickoff: KICKOFF,
});

let seq = 0;
const observation = (
  matchId: MatchId,
  minutes: number,
  state: MatchState,
): Observation =>
  ({
    ...state,
    id: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}` as ObservationId,
    matchId,
    sourceId: "api-football" as SourceId,
    observedAt: at(minutes),
    receivedAt: at(minutes),
    rawRef: "raw/api-football/2026-09-25/x.json.gz",
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

const PROVIDER = () => () => 10;

// Held 2-1 by RN-03, closed by the source 2-0: board says 2-1.
const girona = match("girona-albacete");
const gironaLog = [
  observation(girona.id, 1, live(1, 0, 1)),
  observation(girona.id, 40, live(2, 0, 40)),
  observation(girona.id, 75, live(2, 1, 75)),
  observation(girona.id, 76, live(2, 0, 76)),
  observation(girona.id, 113, finished(2, 0)),
];

// Held 1-1, forced at +120 with a fresh live 1-0: board says 1-1.
const lugo = match("lugo-racing-ferrol");
const lugoLog = [
  observation(lugo.id, 1, live(1, 0, 1)),
  observation(lugo.id, 80, live(1, 1, 80)),
  observation(lugo.id, 81, live(1, 0, 81)),
  observation(lugo.id, 116, live(1, 0, 90)),
  observation(lugo.id, 119, live(1, 0, 90)),
];

// Forced at +120 and the last observation agrees with board: untouched.
const ceuta = match("ceuta-real-sociedad-b");
const ceutaLog = [
  observation(ceuta.id, 1, live(1, 0, 1)),
  observation(ceuta.id, 119, live(2, 1, 90)),
];

const board = (home: number, away: number) => ({
  status: "finished" as const,
  score: { home, away },
});

const run = () =>
  replayJornada({
    matches: [
      { match: girona, board: board(2, 1) },
      { match: lugo, board: board(1, 1) },
      { match: ceuta, board: board(2, 1) },
    ],
    observations: [...gironaLog, ...lugoLog, ...ceutaLog],
    priority: PROVIDER,
    now: TODAY,
  });

describe("SPEC-012 CA-4 sweepInstants", () => {
  it("covers the window of ADR-002 §2 every thirty seconds", () => {
    const instants = sweepInstants(KICKOFF);
    expect(instants[0]).toBe(at(-10));
    expect(instants.at(-1)).toBe(shiftInstant(at(150), -30_000));
    expect(instants).toHaveLength(160 * 2);
    expect(instants).toContain(at(120));
  });
});

describe("SPEC-012 CA-4 replayJornada", () => {
  it("prints board, replay and whether they diverge, match by match", () => {
    expect(
      run().map((r) => ({
        matchId: r.matchId,
        board: r.board,
        replay: r.replay,
        divergent: r.divergent,
      })),
    ).toEqual([
      {
        matchId: ceuta.id,
        board: board(2, 1),
        replay: board(2, 1),
        divergent: false,
      },
      {
        matchId: girona.id,
        board: board(2, 1),
        replay: board(2, 0),
        divergent: true,
      },
      {
        matchId: lugo.id,
        board: board(1, 1),
        replay: board(1, 0),
        divergent: true,
      },
    ]);
  });

  it("drafts one Decision per divergent match: RN-02, today, cited", () => {
    const [c, g, l] = run();
    expect(g.correction).toEqual({
      matchId: girona.id,
      status: "finished",
      score: { home: 2, away: 0 },
      minute: null,
      qualifier: "provisional",
      rule: "RN-02",
      observationIds: [gironaLog[4].id],
      decidedAt: TODAY,
      scoredBy: { home: "api-football", away: "api-football" },
      forcedFinish: false,
    });
    expect(l.correction).toMatchObject({
      matchId: lugo.id,
      status: "finished",
      score: { home: 1, away: 0 },
      rule: "RN-02",
      observationIds: [lugoLog[4].id],
      decidedAt: TODAY,
    });
    expect(c.correction).toBeNull();
  });

  it("never drafts a correction unless both board and replay are finished", () => {
    const [row] = replayJornada({
      matches: [
        {
          match: girona,
          board: { status: "live", score: { home: 2, away: 1 } },
        },
      ],
      observations: gironaLog,
      priority: PROVIDER,
      now: TODAY,
    });
    expect(row.divergent).toBe(true);
    expect(row.correction).toBeNull();
  });

  it("is deterministic and orders the rows by match id", () => {
    expect(run()).toEqual(run());
    expect(run().map((r) => r.matchId)).toEqual([ceuta.id, girona.id, lugo.id]);
  });
});

// SPEC-014 CA-8: a correction is not a close. Its rule stays RN-02 (SPEC-012
// CA-4), but it carries the mark false even when the replay ended in a forced
// finish (lugo: forced at +120 with a fresh live 1-0).
describe("SPEC-014 CA-8 the correction of replay:jornada carries false", () => {
  it("drafts every correction with forcedFinish false and rule RN-02", () => {
    const [, g, l] = run();
    for (const correction of [g.correction, l.correction])
      expect(correction).toMatchObject({ rule: "RN-02", forcedFinish: false });
  });
});

// SPEC-014 CA-6, the pure half: per match, the live ticks — each live
// observation of the source is one tick — in which the published score
// differs from the source's, with the engine of main and with ADR-011's.
describe("SPEC-014 CA-6 live ticks where the published score is not the source's", () => {
  const ticks = (rows: ReturnType<typeof replayJornada>) =>
    Object.fromEntries(rows.map((r) => [r.matchId, r.liveTicks]));

  it("counts the ticks RN-03 held against the source with the engine of main", () => {
    expect(
      ticks(
        replayJornada({
          matches: [
            { match: girona, board: board(2, 1) },
            { match: lugo, board: board(1, 1) },
            { match: ceuta, board: board(2, 1) },
          ],
          observations: [...gironaLog, ...lugoLog, ...ceutaLog],
          priority: PROVIDER,
          now: TODAY,
          engine: decideAt11a7159,
        }),
      ),
    ).toEqual({ [ceuta.id]: 0, [girona.id]: 1, [lugo.id]: 3 });
  });

  it("counts none with the engine of ADR-011: the source withdraws its own goal", () => {
    expect(ticks(run())).toEqual({
      [ceuta.id]: 0,
      [girona.id]: 0,
      [lugo.id]: 0,
    });
  });
});

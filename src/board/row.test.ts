import { afterEach, describe, expect, it, vi } from "vitest";
import { PublicMatch } from "@/model";
import { toPublicMatch, toPublicMatches, type XornadaDbRow } from "./row";

// SPEC-020 CA-4: a web.xornada row as postgres.js returns it (timestamptz as
// Date) becomes a PublicMatch with ISO instants ending in Z; a row that does
// not validate is left out and named, never thrown.

const base: XornadaDbRow = {
  match_id: "celta-coruna-2026-10-10",
  competition_id: "primera-division",
  season: "2026-27",
  competition_name: "Primeira División",
  tier: 1,
  round: 9,
  kickoff: new Date("2026-10-10T16:00:00Z"),
  home_name: "Real Club Celta de Vigo",
  home_short_name: "Celta",
  away_name: "Real Club Deportivo de La Coruña",
  away_short_name: null,
  status: "scheduled",
  home_score: null,
  away_score: null,
  minute: null,
  added_minute: null,
  qualifier: "confirmado",
  version: 0,
  observed_at: null,
  decided_at: null,
  half_time: false,
  home_scored_at: null,
  away_scored_at: null,
};

const decided = {
  version: 3,
  observed_at: new Date("2026-10-10T16:47:00Z"),
  decided_at: new Date("2026-10-10T16:47:05Z"),
};

afterEach(() => vi.restoreAllMocks());

describe("SPEC-020 CA-4 toPublicMatches", () => {
  it("a match without Decision", () => {
    expect(toPublicMatches([base])).toEqual([
      {
        matchId: "celta-coruna-2026-10-10",
        competitionId: "primera-division",
        competitionName: "Primeira División",
        tier: 1,
        round: 9,
        kickoff: "2026-10-10T16:00:00.000Z",
        home: { name: "Real Club Celta de Vigo", shortName: "Celta" },
        away: { name: "Real Club Deportivo de La Coruña", shortName: null },
        status: "scheduled",
        score: null,
        minute: null,
        qualifier: "confirmado",
        version: 0,
        observedAt: null,
        decidedAt: null,
        homeScoredAt: null,
        awayScoredAt: null,
      },
    ]);
  });

  it("live 45+3 keeps the added minute apart, instants in Z", () => {
    const [m] = toPublicMatches([
      {
        ...base,
        ...decided,
        status: "live",
        home_score: 2,
        away_score: 1,
        minute: 45,
        added_minute: 3,
      },
    ]);
    expect(m).toMatchObject({
      status: "live",
      score: { home: 2, away: 1 },
      minute: 45,
      addedMinute: 3,
      halfTime: false,
      version: 3,
      observedAt: "2026-10-10T16:47:00.000Z",
      decidedAt: "2026-10-10T16:47:05.000Z",
    });
  });

  it.each([
    ["finished", { status: "finished", home_score: 1, away_score: 1 }],
    ["suspended", { status: "suspended", home_score: 0, away_score: 1 }],
    [
      "postponed provisional",
      { status: "postponed", qualifier: "provisional" },
    ],
    ["scheduled sen_sinal", { status: "scheduled", qualifier: "sen_sinal" }],
    [
      "live sen_sinal without minute",
      { status: "live", home_score: 0, away_score: 0, qualifier: "sen_sinal" },
    ],
  ])("%s passes PublicMatch", (_name, row) => {
    const out = toPublicMatches([{ ...base, ...decided, ...row }]);
    expect(out).toHaveLength(1);
    expect(PublicMatch.safeParse(out[0]).success).toBe(true);
    expect(out[0].kickoff).toMatch(/Z$/);
  });

  it.each([
    ["an unknown status", { status: "halftime" }],
    [
      "sen_sinal on a finished match",
      {
        status: "finished",
        home_score: 1,
        away_score: 0,
        qualifier: "sen_sinal",
      },
    ],
    [
      "added time outside live",
      {
        status: "finished",
        home_score: 1,
        away_score: 0,
        added_minute: 2,
      },
    ],
    ["half a score", { status: "live", home_score: 1, away_score: null }],
    ["version 0 with a decision instant", { version: 0 }],
  ])("leaves out %s and names its matchId, without throwing", (_name, row) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const good = { ...base, match_id: "ok-match" };
    const bad = { ...base, ...decided, ...row, match_id: "bad-match" };
    const out = toPublicMatches([bad as XornadaDbRow, good]);
    expect(out.map((m) => m.matchId)).toEqual(["ok-match"]);
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0].join(" "))).toContain("bad-match");
  });
});

describe("SPEC-021 CA-6 half_time to halfTime", () => {
  const live = {
    ...base,
    ...decided,
    status: "live",
    home_score: 1,
    away_score: 0,
    minute: 45,
  };

  it("a live row at half-time gives halfTime true, with its minute kept", () => {
    const [m] = toPublicMatches([{ ...live, half_time: true }]);
    expect(m).toMatchObject({ status: "live", minute: 45, halfTime: true });
  });

  it("a live row out of half-time gives halfTime false", () => {
    const [m] = toPublicMatches([{ ...live, half_time: false }]);
    expect(m).toMatchObject({ status: "live", halfTime: false });
  });

  it("a row outside live carries no halfTime", () => {
    const [m] = toPublicMatches([
      { ...base, ...decided, status: "finished", home_score: 1, away_score: 0 },
    ]);
    expect(m).not.toHaveProperty("halfTime");
  });

  it("a live row without the key (the view before the migration) is left out and named (F-SPEC-019-3)", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { half_time: _, ...old } = { ...live, match_id: "old-view" };
    const out = toPublicMatches([
      old as XornadaDbRow,
      { ...base, match_id: "ok-match" },
    ]);
    expect(out.map((m) => m.matchId)).toEqual(["ok-match"]);
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0].join(" "))).toContain("old-view");
    expect(String(error.mock.calls[0].join(" "))).toContain("halfTime");
  });

  it("half_time true outside live is left out, not dropped in silence", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = toPublicMatches([
      {
        ...base,
        ...decided,
        status: "finished",
        home_score: 1,
        away_score: 0,
        half_time: true,
      },
    ]);
    expect(out).toEqual([]);
    expect(error).toHaveBeenCalledTimes(1);
  });
});

// SPEC-024 CA-3: one conversion for the reader (postgres.js, Date) and for
// the Realtime payload (to_jsonb of the same row: strings with an offset and
// microseconds, plus the id realtime.send appends).
describe("SPEC-024 CA-3 one conversion", () => {
  const live = {
    ...base,
    status: "live",
    home_score: 2,
    away_score: 1,
    minute: 45,
    added_minute: 3,
    version: 3,
    observed_at: new Date("2026-10-10T16:47:00.123Z"),
    decided_at: new Date("2026-10-10T16:47:05Z"),
  };
  const payload = {
    ...live,
    kickoff: "2026-10-10T16:00:00+00:00",
    observed_at: "2026-10-10T18:47:00.123456+02:00",
    decided_at: "2026-10-10T16:47:05+00:00",
    id: "6d1f2a52-6c1e-4a51-9f3f-1d8c2b0f8a10",
  };

  it("the same match by the reader and by the payload gives equal objects, in Z", () => {
    const [byReader] = toPublicMatches([live]);
    const byPayload = toPublicMatch(payload);
    expect(byPayload).toEqual(byReader);
    expect(byPayload).toMatchObject({
      kickoff: "2026-10-10T16:00:00.000Z",
      observedAt: "2026-10-10T16:47:00.123Z",
      decidedAt: "2026-10-10T16:47:05.000Z",
    });
  });

  it.each([
    ["an instant that is not one", { kickoff: "mañá" }],
    ["a sixth status", { status: "halftime" }],
    ["a missing column", { tier: undefined }],
  ])(
    "an invalid payload (%s) is dropped with console.error naming the matchId",
    (_n, change) => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(toPublicMatch({ ...payload, ...change })).toBeNull();
      expect(error).toHaveBeenCalledTimes(1);
      expect(String(error.mock.calls[0].join(" "))).toContain(
        "celta-coruna-2026-10-10",
      );
    },
  );

  it.each([null, "x", 3, []])(
    "a payload that is not a row (%s) is dropped",
    (value) => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(toPublicMatch(value)).toBeNull();
      expect(error).toHaveBeenCalledTimes(1);
    },
  );
});

// SPEC-041 CA-2: the two instants of ADR-022, converted like the others.
describe("SPEC-041 CA-2 home_scored_at and away_scored_at", () => {
  const live = {
    ...base,
    ...decided,
    status: "live",
    home_score: 2,
    away_score: 1,
    minute: 60,
    home_scored_at: new Date("2026-10-10T16:45:05Z"),
    away_scored_at: null,
  };

  it("become homeScoredAt and awayScoredAt in Z", () => {
    const [m] = toPublicMatches([live]);
    expect(m).toMatchObject({
      homeScoredAt: "2026-10-10T16:45:05.000Z",
      awayScoredAt: null,
    });
  });

  it("the reader and the payload (offset, microseconds) give the same object", () => {
    const [byReader] = toPublicMatches([live]);
    const byPayload = toPublicMatch({
      ...live,
      kickoff: "2026-10-10T16:00:00+00:00",
      observed_at: "2026-10-10T16:47:00+00:00",
      decided_at: "2026-10-10T18:47:05+02:00",
      home_scored_at: "2026-10-10T18:45:05.000000+02:00",
      id: "6d1f2a52-6c1e-4a51-9f3f-1d8c2b0f8a10",
    });
    expect(byPayload).toEqual(byReader);
  });

  it("an instant on a postponed row is left out and named", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = toPublicMatches([
      {
        ...base,
        ...decided,
        status: "postponed",
        match_id: "bad-postponed",
        away_scored_at: new Date("2026-10-10T16:45:05Z"),
      },
    ]);
    expect(out).toEqual([]);
    expect(String(error.mock.calls[0].join(" "))).toContain("bad-postponed");
  });

  it("a row without the columns (the view before the migration) is left out", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const {
      home_scored_at: _,
      away_scored_at: __,
      ...old
    } = {
      ...live,
      match_id: "old-view",
    };
    expect(toPublicMatches([old as XornadaDbRow])).toEqual([]);
    expect(String(error.mock.calls[0].join(" "))).toContain("homeScoredAt");
  });
});

describe("SPEC-060 CA-1 goals in toPublicMatches", () => {
  it("maps goals array from row to PublicMatch", () => {
    const rowWithGoals: XornadaDbRow = {
      ...base,
      ...decided,
      status: "finished",
      home_score: 2,
      away_score: 1,
      goals: [
        {
          team: "home",
          player: "Aspas",
          minute: 15,
          penalty: false,
          ownGoal: false,
        },
        {
          team: "away",
          player: "Visitante",
          minute: 40,
          penalty: true,
          ownGoal: false,
        },
        {
          team: "home",
          player: "Borja",
          minute: 88,
          penalty: false,
          own_goal: false,
        },
      ],
    };

    const [pm] = toPublicMatches([rowWithGoals]);
    expect(pm.goals).toEqual([
      { team: "home", player: "Aspas", minute: 15 },
      { team: "away", player: "Visitante", minute: 40, penalty: true },
      { team: "home", player: "Borja", minute: 88 },
    ]);
  });

  it("handles stringified JSON goals (e.g. from Realtime delta)", () => {
    const rowWithStringGoals: XornadaDbRow = {
      ...base,
      ...decided,
      status: "live",
      home_score: 1,
      away_score: 0,
      goals: JSON.stringify([
        {
          team: "home",
          player: "Lozano",
          minute: 33,
          penalty: false,
          own_goal: false,
        },
      ]),
    };

    const [pm] = toPublicMatches([rowWithStringGoals]);
    expect(pm.goals).toEqual([{ team: "home", player: "Lozano", minute: 33 }]);
  });

  it("omits goals when empty array or null", () => {
    const rowEmptyGoals: XornadaDbRow = {
      ...base,
      ...decided,
      status: "finished",
      home_score: 0,
      away_score: 0,
      goals: [],
    };

    const [pm] = toPublicMatches([rowEmptyGoals]);
    expect(pm.goals).toBeUndefined();
  });
});

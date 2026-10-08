import { describe, expect, it } from "vitest";
import { MatchStatus } from "./index.ts";
import { PublicMatch } from "./public.ts";

const base = {
  matchId: "primera-division-2026-27-j8-celta-real-madrid",
  competitionId: "primera-division",
  competitionName: "Primeira División",
  tier: 1,
  round: 8,
  kickoff: "2026-10-03T16:15:00Z",
  home: { name: "RC Celta", shortName: "Celta" },
  away: { name: "Real Madrid", shortName: null },
  qualifier: "confirmado",
  version: 4,
  observedAt: "2026-10-03T17:01:00Z",
  decidedAt: "2026-10-03T17:01:05Z",
};

const score = { home: 1, away: 0 };

const examples = {
  scheduled: {
    ...base,
    status: "scheduled",
    score: null,
    minute: null,
    version: 0,
    observedAt: null,
    decidedAt: null,
  },
  live: {
    ...base,
    status: "live",
    score,
    minute: 45,
    addedMinute: 3,
    halfTime: false,
  },
  finished: { ...base, status: "finished", score, minute: null },
  postponed: { ...base, status: "postponed", score: null, minute: null },
  suspended: { ...base, status: "suspended", score, minute: null },
} as const;

const ok = (v: unknown) => PublicMatch.safeParse(v).success;

describe("SPEC-019 CA-1 PublicMatch", () => {
  it.each(MatchStatus.options)("accepts an example of %s", (status) => {
    const parsed = PublicMatch.safeParse(examples[status]);
    expect(parsed.error).toBeUndefined();
    expect(parsed.data?.status).toBe(status);
  });

  it("covers exactly the MatchStatus vocabulary", () => {
    expect(PublicMatch.options.map((o) => o.shape.status.value)).toEqual(
      MatchStatus.options,
    );
  });

  it.each([
    ["sourceId", "api-football"],
    ["rule", "RN-01"],
    ["observationIds", ["018f3b7e-1c2a-7d5e-9a3f-1234567890ab"]],
    ["scoredBy", { home: null, away: null }],
  ])("rejects the extra key %s instead of dropping it", (key, value) => {
    expect(ok({ ...examples.live, [key]: value })).toBe(false);
    expect(ok({ ...examples.scheduled, [key]: value })).toBe(false);
  });

  it("rejects extra keys inside a team", () => {
    expect(
      ok({
        ...examples.finished,
        home: { ...base.home, id: "celta" },
      }),
    ).toBe(false);
  });

  it("rejects live without a score and scheduled with one", () => {
    expect(ok({ ...examples.live, score: null })).toBe(false);
    expect(ok({ ...examples.scheduled, score })).toBe(false);
  });

  it("requires shortName as nullable, never missing", () => {
    expect(ok({ ...examples.finished, away: { name: "Real Madrid" } })).toBe(
      false,
    );
  });

  it("version is an integer >= 0, and 0 only without a Decision", () => {
    expect(ok({ ...examples.live, version: -1 })).toBe(false);
    expect(ok({ ...examples.live, version: 1.5 })).toBe(false);
    expect(ok({ ...examples.live, version: 0 })).toBe(false);
    expect(ok({ ...examples.scheduled, version: 1 })).toBe(false);
  });

  it("observedAt and decidedAt are Instants or null", () => {
    expect(
      ok({ ...examples.finished, observedAt: "2026-10-03T19:01:00+02:00" }),
    ).toBe(false);
    expect(ok({ ...examples.finished, observedAt: null })).toBe(true);
  });

  it("sen_sinal only in live or scheduled (RN-05, ADR-013 §2)", () => {
    expect(ok({ ...examples.live, qualifier: "sen_sinal" })).toBe(true);
    expect(
      ok({
        ...examples.scheduled,
        qualifier: "sen_sinal",
        version: 2,
        decidedAt: base.decidedAt,
      }),
    ).toBe(true);
    expect(ok({ ...examples.finished, qualifier: "sen_sinal" })).toBe(false);
  });

  it("tier is 1..5", () => {
    expect(ok({ ...examples.finished, tier: 0 })).toBe(false);
    expect(ok({ ...examples.finished, tier: 6 })).toBe(false);
  });
});

describe("SPEC-021 CA-6 PublicMatch carries halfTime only in live", () => {
  it("live demands an explicit boolean halfTime", () => {
    expect(ok({ ...examples.live, halfTime: true })).toBe(true);
    expect(ok({ ...examples.live, halfTime: false })).toBe(true);
    const { halfTime: _, ...missing } = examples.live;
    expect(ok(missing)).toBe(false);
    expect(ok({ ...examples.live, halfTime: null })).toBe(false);
  });

  it.each(["scheduled", "finished", "postponed", "suspended"] as const)(
    "%s rejects halfTime, true or false",
    (status) => {
      expect(ok({ ...examples[status], halfTime: false })).toBe(false);
      expect(ok({ ...examples[status], halfTime: true })).toBe(false);
    },
  );
});

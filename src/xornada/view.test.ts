import { describe, expect, it } from "vitest";
import {
  type MatchStatus,
  PublicMatch,
  type Qualifier,
  type Score,
} from "@/model";
import { buildXornada, madridDate, minuteLabel, xornadaDays } from "./view";

type Overrides = {
  id?: string;
  tier?: number;
  round?: number;
  status?: MatchStatus;
  score?: Score | null;
  minute?: number | null;
  addedMinute?: number | null;
  halfTime?: boolean;
  qualifier?: Qualifier;
  kickoff?: string;
  home?: { name: string; shortName: string | null };
  away?: { name: string; shortName: string | null };
};

const COMPETITIONS: Record<number, [string, string]> = {
  1: ["primera-division", "Primeira División"],
  2: ["segunda-division", "Segunda División"],
  3: ["primera-rfef-g1", "Primeira Federación · Grupo 1"],
  4: ["segunda-rfef-g1", "Segunda Federación · Grupo 1"],
  5: ["tercera-rfef-g1", "Terceira Federación · Grupo 1"],
};

let seq = 0;
function match(o: Overrides = {}): PublicMatch {
  const status = o.status ?? "scheduled";
  const tier = o.tier ?? 1;
  const [competitionId, competitionName] = COMPETITIONS[tier];
  const hasScore = status === "live" || status === "finished";
  const scored = hasScore || status === "suspended";
  seq += 1;
  return PublicMatch.parse({
    matchId: o.id ?? `m-${seq}`,
    competitionId,
    competitionName,
    tier,
    round: o.round ?? 8,
    kickoff: o.kickoff ?? "2026-10-03T16:00:00Z",
    home: o.home ?? { name: "RC Celta", shortName: "Celta" },
    away: o.away ?? { name: "Real Madrid", shortName: null },
    status,
    score:
      o.score !== undefined ? o.score : scored ? { home: 1, away: 0 } : null,
    minute: status === "live" ? (o.minute !== undefined ? o.minute : 30) : null,
    ...(status === "live"
      ? { addedMinute: o.addedMinute ?? null, halfTime: o.halfTime ?? false }
      : {}),
    qualifier: o.qualifier ?? "confirmado",
    version: 3,
    observedAt: "2026-10-03T16:30:00Z",
    decidedAt: "2026-10-03T16:30:02Z",
  });
}

const rowOf = (m: PublicMatch) => {
  const [competition] = buildXornada([m]);
  return competition.rows[0];
};

describe("SPEC-019 CA-2 buildXornada rows: state × qualifier", () => {
  const kickoff = "2026-10-03T16:00:00Z";
  it.each([
    ["scheduled", "confirmado", { kind: "time", kickoff }, null],
    [
      "scheduled",
      "sen_sinal",
      { kind: "time", kickoff },
      "qualifier.sen_sinal",
    ],
    [
      "live",
      "confirmado",
      { kind: "minute", minute: 30, addedMinute: null },
      null,
    ],
    [
      "live",
      "provisional",
      { kind: "minute", minute: 30, addedMinute: null },
      "qualifier.provisional",
    ],
    [
      "live",
      "sen_sinal",
      { kind: "minute", minute: 30, addedMinute: null },
      "qualifier.sen_sinal",
    ],
    ["finished", "confirmado", { kind: "status" }, null],
    ["finished", "provisional", { kind: "status" }, "qualifier.provisional"],
    ["postponed", "confirmado", { kind: "status" }, null],
    ["postponed", "provisional", { kind: "status" }, "qualifier.provisional"],
    ["suspended", "confirmado", { kind: "status" }, null],
    ["suspended", "provisional", { kind: "status" }, "qualifier.provisional"],
  ] as const)("%s · %s", (status, qualifier, margin, qualifierKey) => {
    const row = rowOf(match({ status, qualifier, kickoff }));
    expect(row.status).toBe(status);
    expect(row.statusKey).toBe(`status.${status}`);
    expect(row.margin).toEqual(margin);
    expect(row.qualifierKey).toBe(qualifierKey);
    const scored =
      status === "live" || status === "finished" || status === "suspended";
    expect(row.score).toEqual(scored ? { home: 1, away: 0 } : null);
  });

  it("shows shortName, and name when there is no shortName", () => {
    const row = rowOf(match());
    expect(row.home).toBe("Celta");
    expect(row.away).toBe("Real Madrid");
  });

  it("live with minute null puts the status in the margin (En xogo)", () => {
    const row = rowOf(match({ status: "live", minute: null }));
    expect(row.margin).toEqual({ kind: "status" });
    expect(row.statusKey).toBe("status.live");
  });

  it("45+3 is not 46 (N-8)", () => {
    const stoppage = rowOf(
      match({ status: "live", minute: 45, addedMinute: 3 }),
    );
    const second = rowOf(match({ status: "live", minute: 46 }));
    expect(stoppage.margin).toEqual({
      kind: "minute",
      minute: 45,
      addedMinute: 3,
    });
    expect(second.margin).toEqual({
      kind: "minute",
      minute: 46,
      addedMinute: null,
    });
    if (stoppage.margin.kind !== "minute" || second.margin.kind !== "minute")
      throw new Error("expected minutes");
    expect(minuteLabel(stoppage.margin)).toBe("45+3'");
    expect(minuteLabel(second.margin)).toBe("46'");
  });

  it("finished has a winner; a draw has none; other states have none", () => {
    expect(
      rowOf(match({ status: "finished", score: { home: 2, away: 1 } })).winner,
    ).toBe("home");
    expect(
      rowOf(match({ status: "finished", score: { home: 0, away: 3 } })).winner,
    ).toBe("away");
    expect(
      rowOf(match({ status: "finished", score: { home: 1, away: 1 } })).winner,
    ).toBeNull();
    expect(
      rowOf(match({ status: "live", score: { home: 2, away: 0 } })).winner,
    ).toBeNull();
    expect(
      rowOf(match({ status: "suspended", score: { home: 2, away: 0 } })).winner,
    ).toBeNull();
  });
});

describe("SPEC-019 CA-2 buildXornada order", () => {
  it("competitions by tier ascending even when the input is shuffled (H-1)", () => {
    const xornada = buildXornada(
      [5, 2, 4, 1, 3].map((tier) => match({ tier })),
    );
    expect(xornada.map((c) => c.tier)).toEqual([1, 2, 3, 4, 5]);
    expect(xornada.map((c) => c.competitionId)).toEqual([
      "primera-division",
      "segunda-division",
      "primera-rfef-g1",
      "segunda-rfef-g1",
      "tercera-rfef-g1",
    ]);
    expect(xornada[4].name).toBe("Terceira Federación · Grupo 1");
  });

  it("rows in the design order: live, finished, suspended, scheduled, postponed (H-2)", () => {
    const statuses: MatchStatus[] = [
      "postponed",
      "scheduled",
      "suspended",
      "finished",
      "live",
    ];
    const [competition] = buildXornada(
      statuses.map((status) => match({ status })),
    );
    expect(competition.rows.map((r) => r.status)).toEqual([
      "live",
      "finished",
      "suspended",
      "scheduled",
      "postponed",
    ]);
  });

  it("ties by kickoff, then matchId", () => {
    const [competition] = buildXornada([
      match({ id: "b", kickoff: "2026-10-03T18:00:00Z" }),
      match({ id: "c", kickoff: "2026-10-03T16:00:00Z" }),
      match({ id: "a", kickoff: "2026-10-03T18:00:00Z" }),
    ]);
    expect(competition.rows.map((r) => r.matchId)).toEqual(["c", "a", "b"]);
  });

  it("counts the live matches of each competition", () => {
    const xornada = buildXornada([
      match({ tier: 1, status: "live" }),
      match({ tier: 1, status: "live", qualifier: "sen_sinal" }),
      match({ tier: 1, status: "finished" }),
      match({ tier: 2, status: "scheduled" }),
    ]);
    expect(xornada.map((c) => c.liveCount)).toEqual([2, 0]);
  });

  it("an empty board is an empty xornada", () => {
    expect(buildXornada([])).toEqual([]);
  });
});

// SPEC-021 CA-7: half-time is a moment inside live. The row stays in live, no
// minute is shown even when the source has one, and the margin says the word.
describe("SPEC-021 CA-7 half-time in the view", () => {
  it.each([
    ["confirmado", 45, null, null],
    ["provisional", 45, 2, "qualifier.provisional"],
    ["sen_sinal", 45, null, "qualifier.sen_sinal"],
    ["confirmado", null, null, null],
  ] as const)(
    "live %s at half-time (minute %s+%s) has the halfTime margin",
    (qualifier, minute, addedMinute, qualifierKey) => {
      const row = rowOf(
        match({
          status: "live",
          halfTime: true,
          qualifier,
          minute,
          addedMinute,
        }),
      );
      expect(row.margin).toEqual({ kind: "halfTime" });
      expect(row.status).toBe("live");
      expect(row.statusKey).toBe("status.live");
      expect(row.qualifier).toBe(qualifier);
      expect(row.qualifierKey).toBe(qualifierKey);
      expect(row.score).toEqual({ home: 1, away: 0 });
    },
  );

  it("live out of half-time keeps its minute", () => {
    expect(
      rowOf(match({ status: "live", halfTime: false, minute: 47 })).margin,
    ).toEqual({ kind: "minute", minute: 47, addedMinute: null });
  });

  it("a half-time row stays first, with live, and counts in the en xogo pill", () => {
    const [competition] = buildXornada([
      match({ status: "finished" }),
      match({ status: "live", halfTime: true, id: "ht" }),
      match({ status: "scheduled" }),
      match({ status: "live", halfTime: true, qualifier: "sen_sinal" }),
    ]);
    expect(competition.liveCount).toBe(2);
    expect(competition.rows.map((r) => r.status)).toEqual([
      "live",
      "live",
      "finished",
      "scheduled",
    ]);
    expect(competition.rows.slice(0, 2).map((r) => r.margin.kind)).toEqual([
      "halfTime",
      "halfTime",
    ]);
  });
});

// SPEC-023 CA-1: the days of the xornada, in Europe/Madrid, from the kickoffs.
describe("SPEC-023 CA-1 madridDate", () => {
  it.each([
    ["2026-10-24T22:30:00Z", "2026-10-25"], // CEST: +2
    ["2026-10-25T23:30:00Z", "2026-10-26"], // CET after the change: +1
    ["2026-10-25T22:59:00Z", "2026-10-25"],
    ["2026-03-29T00:30:00Z", "2026-03-29"],
    ["2026-12-31T23:00:00Z", "2027-01-01"],
  ])("%s → %s", (instant, date) => {
    expect(madridDate(instant)).toBe(date);
  });
});

describe("SPEC-023 CA-1 xornadaDays", () => {
  it("an empty list has no days", () => {
    expect(xornadaDays([], "2026-10-03T12:00:00Z")).toEqual([]);
  });

  it("distinct Madrid dates, ascending, across the change of time", () => {
    const days = xornadaDays(
      [
        match({ kickoff: "2026-10-25T23:30:00Z" }),
        match({ kickoff: "2026-10-24T22:30:00Z" }),
        match({ kickoff: "2026-10-25T10:00:00Z" }),
        match({ kickoff: "2026-10-23T18:00:00Z" }),
      ],
      "2026-10-24T09:00:00Z",
    );
    expect(days).toEqual([
      {
        date: "2026-10-23",
        weekdayKey: "weekday.fri",
        dayOfMonth: 23,
        monthKey: "month.oct",
        otherMonth: false,
        today: false,
      },
      {
        date: "2026-10-25",
        weekdayKey: "weekday.sun",
        dayOfMonth: 25,
        monthKey: "month.oct",
        otherMonth: false,
        today: false,
      },
      {
        date: "2026-10-26",
        weekdayKey: "weekday.mon",
        dayOfMonth: 26,
        monthKey: "month.oct",
        otherMonth: false,
        today: false,
      },
    ]);
  });

  it("today only on the Madrid date of now", () => {
    const matches = [
      match({ kickoff: "2026-10-03T16:00:00Z" }),
      match({ kickoff: "2026-10-04T16:00:00Z" }),
    ];
    // 22:30Z on the 3rd is already the 4th in Madrid.
    expect(
      xornadaDays(matches, "2026-10-03T22:30:00Z").map((d) => [
        d.date,
        d.today,
      ]),
    ).toEqual([
      ["2026-10-03", false],
      ["2026-10-04", true],
    ]);
    expect(
      xornadaDays(matches, "2026-10-05T10:00:00Z").some((d) => d.today),
    ).toBe(false);
  });

  it("a live match of another round adds its day", () => {
    const days = xornadaDays(
      [
        match({ round: 8, kickoff: "2026-10-03T16:00:00Z" }),
        match({ round: 7, status: "live", kickoff: "2026-10-01T18:00:00Z" }),
      ],
      "2026-10-01T19:00:00Z",
    );
    expect(days.map((d) => d.date)).toEqual(["2026-10-01", "2026-10-03"]);
    expect(days[0]).toMatchObject({ weekdayKey: "weekday.thu", today: true });
  });

  it("B-2: the month, and whether it is not the month of today (Madrid)", () => {
    const days = xornadaDays(
      [
        match({ status: "live", kickoff: "2026-09-12T16:00:00Z" }),
        match({ kickoff: "2026-10-09T18:00:00Z" }),
        match({ kickoff: "2026-11-01T12:00:00Z" }),
      ],
      "2026-10-08T10:00:00Z",
    );
    expect(days.map((d) => [d.date, d.monthKey, d.otherMonth])).toEqual([
      ["2026-09-12", "month.sep", true],
      ["2026-10-09", "month.oct", false],
      ["2026-11-01", "month.nov", true],
    ]);
    // 22:30Z on 30 September is already 1 October in Madrid: same month.
    expect(
      xornadaDays(
        [match({ kickoff: "2026-10-01T10:00:00Z" })],
        "2026-09-30T22:30:00Z",
      )[0].otherMonth,
    ).toBe(false);
    // Same month of another year is another month.
    expect(
      xornadaDays(
        [match({ kickoff: "2025-10-04T10:00:00Z" })],
        "2026-10-03T10:00:00Z",
      )[0].otherMonth,
    ).toBe(true);
  });

  it("every weekday has its key", () => {
    const days = xornadaDays(
      [5, 6, 7, 8, 9, 10, 11].map((d) =>
        match({ kickoff: `2026-10-${String(d).padStart(2, "0")}T12:00:00Z` }),
      ),
      "2026-10-01T00:00:00Z",
    );
    expect(days.map((d) => d.weekdayKey)).toEqual([
      "weekday.mon",
      "weekday.tue",
      "weekday.wed",
      "weekday.thu",
      "weekday.fri",
      "weekday.sat",
      "weekday.sun",
    ]);
  });
});

describe("SPEC-023 CA-1 buildXornada day and round", () => {
  it("each row carries its Madrid day", () => {
    const [competition] = buildXornada([
      match({ id: "a", kickoff: "2026-10-24T22:30:00Z" }),
      match({ id: "b", kickoff: "2026-10-24T16:00:00Z" }),
    ]);
    expect(
      Object.fromEntries(competition.rows.map((r) => [r.matchId, r.day])),
    ).toEqual({ a: "2026-10-25", b: "2026-10-24" });
  });

  it("each competition carries the most frequent round of its rows", () => {
    const [competition] = buildXornada([
      match({ round: 9 }),
      match({ round: 8 }),
      match({ round: 9 }),
    ]);
    expect(competition.round).toBe(9);
  });

  it("a tie of rounds goes to the lower one", () => {
    const [competition] = buildXornada([
      match({ round: 9 }),
      match({ round: 8 }),
    ]);
    expect(competition.round).toBe(8);
  });
});

// SPEC-025 CA-3 (H-2): the row carries the version of its Decision, so the
// probe can tell which Decision a paint shows (0: no Decision yet).
describe("SPEC-025 CA-3 the row carries its version", () => {
  it("is the version of the PublicMatch", () => {
    expect(rowOf(match({ status: "live" })).version).toBe(3);
  });
});

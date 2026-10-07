import { describe, expect, it } from "vitest";
import {
  type MatchStatus,
  PublicMatch,
  type Qualifier,
  type Score,
} from "@/model";
import { buildXornada, minuteLabel } from "./view";

type Overrides = {
  id?: string;
  tier?: number;
  status?: MatchStatus;
  score?: Score | null;
  minute?: number | null;
  addedMinute?: number | null;
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
    round: 8,
    kickoff: o.kickoff ?? "2026-10-03T16:00:00Z",
    home: o.home ?? { name: "RC Celta", shortName: "Celta" },
    away: o.away ?? { name: "Real Madrid", shortName: null },
    status,
    score:
      o.score !== undefined ? o.score : scored ? { home: 1, away: 0 } : null,
    minute: status === "live" ? (o.minute !== undefined ? o.minute : 30) : null,
    ...(status === "live" ? { addedMinute: o.addedMinute ?? null } : {}),
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

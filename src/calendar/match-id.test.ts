import { describe, expect, it } from "vitest";
import { MatchId } from "../model/index.ts";
import { matchId } from "./match-id.ts";

const base = {
  competitionId: "tercera-rfef-g1",
  season: "2026-27",
  round: 1,
  homeTeamId: "ud-ourense",
  awayTeamId: "cd-arenteiro",
} as const;

describe("CA-2 matchId", () => {
  it("derives <competition>-<season>-j<round>-<home>-<away>", () => {
    expect(matchId(base)).toBe(
      "tercera-rfef-g1-2026-27-j1-ud-ourense-cd-arenteiro",
    );
  });

  it("does not depend on kickoff", () => {
    const withKickoff = { ...base, kickoff: "2026-09-20T16:00:00Z" };
    expect(matchId(withKickoff)).toBe(matchId(base));
  });

  it("changes when home and away are swapped", () => {
    const swapped = {
      ...base,
      homeTeamId: base.awayTeamId,
      awayTeamId: base.homeTeamId,
    };
    expect(matchId(swapped)).not.toBe(matchId(base));
    expect(matchId(swapped)).toBe(
      "tercera-rfef-g1-2026-27-j1-cd-arenteiro-ud-ourense",
    );
  });

  it("keeps j1 and j10 distinct, without zero padding", () => {
    expect(matchId({ ...base, round: 10 })).toBe(
      "tercera-rfef-g1-2026-27-j10-ud-ourense-cd-arenteiro",
    );
    expect(matchId({ ...base, round: 10 })).not.toBe(matchId(base));
  });

  it("parses with MatchId", () => {
    expect(MatchId.safeParse(matchId(base)).success).toBe(true);
  });

  it("throws on round 0", () => {
    expect(() => matchId({ ...base, round: 0 })).toThrow();
  });
});

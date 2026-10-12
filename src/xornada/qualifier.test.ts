import { describe, expect, it } from "vitest";
import { type MatchStatus, PublicMatch, type Qualifier } from "@/model";
import {
  PROVISIONAL_DISPLAYS,
  type ProvisionalDisplay,
  provisionalLegendShown,
  qualifierDisplay,
} from "./qualifier";
import { buildXornada } from "./view";

// SPEC-034 CA-1: how a row paints its qualifier, by mode. Only provisional
// depends on the mode: confirmado is never painted and sen_sinal always has
// its label (D-9).

// The state × qualifier pairs the model allows (SPEC-019 CA-2).
const ALLOWED: readonly [MatchStatus, Qualifier][] = [
  ["scheduled", "confirmado"],
  ["scheduled", "sen_sinal"],
  ["live", "confirmado"],
  ["live", "provisional"],
  ["live", "sen_sinal"],
  ["finished", "confirmado"],
  ["finished", "provisional"],
  ["postponed", "confirmado"],
  ["postponed", "provisional"],
  ["suspended", "confirmado"],
  ["suspended", "provisional"],
];

const EXPECTED: Record<
  ProvisionalDisplay,
  Record<Qualifier, ReturnType<typeof qualifierDisplay>>
> = {
  label: {
    confirmado: { kind: "none" },
    provisional: { kind: "label", key: "qualifier.provisional" },
    sen_sinal: { kind: "label", key: "qualifier.sen_sinal" },
  },
  mark: {
    confirmado: { kind: "none" },
    provisional: { kind: "mark", key: "qualifier.provisional" },
    sen_sinal: { kind: "label", key: "qualifier.sen_sinal" },
  },
  hidden: {
    confirmado: { kind: "none" },
    provisional: { kind: "none" },
    sen_sinal: { kind: "label", key: "qualifier.sen_sinal" },
  },
};

function match(status: MatchStatus, qualifier: Qualifier): PublicMatch {
  const scored =
    status === "live" || status === "finished" || status === "suspended";
  return PublicMatch.parse({
    matchId: `m-${status}-${qualifier.replace("_", "-")}`,
    competitionId: "primera-division",
    competitionName: "Primeira División",
    tier: 1,
    round: 8,
    kickoff: "2026-10-03T16:00:00Z",
    home: { name: "RC Celta", shortName: "Celta" },
    away: { name: "Real Madrid", shortName: null },
    status,
    score: scored ? { home: 1, away: 0 } : null,
    minute: status === "live" ? 30 : null,
    ...(status === "live" ? { addedMinute: null, halfTime: false } : {}),
    qualifier,
    version: 3,
    observedAt: "2026-10-03T16:30:00Z",
    decidedAt: "2026-10-03T16:30:02Z",
  });
}

describe("SPEC-034 CA-1 provisional display modes", () => {
  it("has exactly the three modes", () => {
    expect([...PROVISIONAL_DISPLAYS]).toEqual(["label", "mark", "hidden"]);
  });

  const cases = PROVISIONAL_DISPLAYS.flatMap((mode) =>
    ALLOWED.map(([status, qualifier]) => [mode, qualifier, status] as const),
  );

  it.each(cases)("%s · %s · %s", (mode, qualifier, status) => {
    expect(qualifierDisplay(qualifier, mode)).toEqual(
      EXPECTED[mode][qualifier],
    );
    const [competition] = buildXornada(
      [match(status, qualifier)],
      undefined,
      mode,
    );
    const [row] = competition.rows;
    expect(row.qualifier).toBe(qualifier);
    expect(row.qualifierDisplay).toEqual(EXPECTED[mode][qualifier]);
  });

  it("buildXornada keeps the label of SPEC-019 when no mode is given", () => {
    const [competition] = buildXornada([match("live", "provisional")]);
    expect(competition.rows[0].qualifierDisplay).toEqual({
      kind: "label",
      key: "qualifier.provisional",
    });
  });
});

describe("SPEC-034 CA-3 the legend of the mark", () => {
  it.each([
    ["mark", ["confirmado", "provisional"], true],
    ["mark", ["confirmado", "sen_sinal"], false],
    ["mark", [], false],
    ["label", ["provisional"], false],
    ["hidden", ["provisional"], false],
  ] as const)("%s over %j → %s", (mode, qualifiers, shown) => {
    expect(provisionalLegendShown(mode, qualifiers)).toBe(shown);
  });
});

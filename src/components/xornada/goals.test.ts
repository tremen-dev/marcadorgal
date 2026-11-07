import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MatchId, Score } from "@/model";
import type { XornadaRow } from "@/xornada/view";
import { MatchRow } from "./MatchRow.tsx";

const mockRow = (overrides?: Partial<XornadaRow>): XornadaRow => ({
  matchId: "liga-f-2026-27-j9-depor-abanca-barcelona" as MatchId,
  status: "live",
  qualifier: "confirmado",
  home: "Deportivo ABANCA",
  away: "FC Barcelona Femení",
  homeGalician: true,
  awayGalician: false,
  score: { home: 1, away: 2 } as Score,
  margin: { kind: "minute", minute: 74, addedMinute: null },
  statusKey: "status.live",
  qualifierKey: null,
  qualifierDisplay: { kind: "none" },
  winner: null,
  day: "2026-11-08",
  date: null,
  part: "second",
  version: 2,
  homeScoredAt: null,
  awayScoredAt: null,
  ...overrides,
});

describe("MatchRow Embedded Goals", () => {
  it("renders goals when provided on the row", () => {
    const row = mockRow({
      goals: [
        { team: "home", player: "Millene", minute: 23, penalty: true },
        { team: "away", player: "Alexia", minute: 45 },
        { team: "away", player: "Aitana", minute: 61, ownGoal: true },
      ],
    });

    const html = renderToStaticMarkup(
      createElement(MatchRow, {
        row,
        locale: "gl",
      }),
    );

    expect(html).toContain('data-testid="match-goals"');
    expect(html).toContain("Millene");
    expect(html).toContain("23");
    expect(html).toContain("(p.)");
    expect(html).toContain("Alexia");
    expect(html).toContain("45");
    expect(html).toContain("Aitana");
    expect(html).toContain("61");
    expect(html).toContain("(p.p.)");
  });

  it("does not render match-goals when row has no goals", () => {
    const row = mockRow({ goals: [] });
    const html = renderToStaticMarkup(
      createElement(MatchRow, {
        row,
        locale: "gl",
      }),
    );

    expect(html).not.toContain('data-testid="match-goals"');
  });

  it("renders half-time state correctly", () => {
    const row = mockRow({
      margin: { kind: "halfTime" },
      part: "halfTime",
    });

    const html = renderToStaticMarkup(
      createElement(MatchRow, {
        row,
        locale: "gl",
      }),
    );

    expect(html).toContain("DESCANSO");
  });
});

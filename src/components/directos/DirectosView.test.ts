import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MatchId, Score } from "@/model";
import type { XornadaRow } from "@/xornada/view";
import type {
  GroupedCompetitionMatches,
  TransformedGoal,
} from "../../lib/explorer-matches.ts";
import { MatchRow } from "../xornada/MatchRow.tsx";
import { DirectosView } from "./DirectosView.tsx";

const GOALS: TransformedGoal[] = [
  { team: "away", player: "Aitana Bonmatí", minute: 61, ownGoal: true },
  { team: "home", player: "Millene", minute: 23, penalty: true },
  { team: "away", player: "Alexia Putellas", minute: 45 },
];

const sampleData: GroupedCompetitionMatches[] = [
  {
    competitionId: "liga-f",
    competitionName: "Liga F Moeve",
    category: "femenino",
    tier: 1,
    liveCount: 1,
    matches: [
      {
        id: "m1",
        codActa: null,
        competitionId: "liga-f",
        competitionName: "Liga F Moeve",
        homeTeam: "Deportivo ABANCA",
        awayTeam: "FC Barcelona Femení",
        canonicalHomeTeamId: "depor-abanca",
        canonicalAwayTeamId: "barcelona-femenino",
        homeGalician: true,
        awayGalician: false,
        homeShield: "/escudos/depor-abanca.svg",
        homeScore: 1,
        awayScore: 2,
        status: "live",
        originalStatus: "LIVE_PROVISIONAL",
        minute: 68,
        addedMinute: null,
        halfTime: false,
        goals: GOALS,
      },
    ],
  },
  {
    competitionId: "primera-federacion-fem",
    competitionName: "Primera Federación Femenina",
    category: "femenino",
    tier: 2,
    liveCount: 0,
    matches: [
      {
        id: "m2",
        codActa: null,
        competitionId: "primera-federacion-fem",
        competitionName: "Primera Federación Femenina",
        homeTeam: "Alavés Gloriosas",
        awayTeam: "Osasuna Femenino",
        homeGalician: false,
        awayGalician: false,
        homeScore: 0,
        awayScore: 0,
        status: "live",
        originalStatus: "LIVE_PROVISIONAL",
        minute: 45,
        addedMinute: 2,
        halfTime: true,
        goals: [],
      },
    ],
  },
];

const renderDirectos = (locale: "gl" | "es" = "gl") =>
  renderToStaticMarkup(
    createElement(DirectosView, {
      date: "2026-11-08",
      groupedCompetitions: sampleData,
      locale,
    }),
  );

// The outer HTML of every element with the given data-testid, in DOM order.
function elements(html: string, testId: string): string[] {
  const out: string[] = [];
  const open = new RegExp(`<(\\w+)[^>]*data-testid="${testId}"[^>]*>`, "g");
  for (const m of html.matchAll(open)) {
    const tag = m[1];
    const start = m.index ?? 0;
    let depth = 0;
    const tagRe = new RegExp(`<(/?)${tag}\\b[^>]*>`, "g");
    let end = -1;
    for (const t of html.slice(start).matchAll(tagRe)) {
      depth += t[1] === "/" ? -1 : 1;
      if (depth === 0) {
        end = start + (t.index ?? 0) + t[0].length;
        break;
      }
    }
    out.push(html.slice(start, end === -1 ? undefined : end));
  }
  return out;
}

describe("DirectosView Component", () => {
  it("renders day matches grouped by women football competitions with live goals and halftime", () => {
    const html = renderDirectos();

    expect(html).toContain('data-testid="directos-view"');
    // Group headers
    expect(html).toContain("Liga F Moeve");
    expect(html).toContain("Primera Federación Femenina");
    expect(html).toContain("Fútbol Feminino");

    // Match 1
    expect(html).toContain("Deportivo ABANCA");
    expect(html).toContain("/escudos/depor-abanca.svg");
    expect(html).toContain("68&#x27;");
    expect(html).toContain("Millene");
    expect(html).toContain("23&#x27;");
    expect(html).toContain("(p.)");
    expect(html).toContain("Alexia");
    expect(html).toContain("45&#x27;");

    // Match 2 (HalfTime)
    expect(html).toContain("Alavés Gloriosas");
    expect(html).toContain("Descanso");
  });
});

describe("SPEC-068 CA-7 /directos paints the same scorers", () => {
  it("hangs each side's goals under its teamLine, always visible, without interaction", () => {
    const html = renderDirectos();
    const card = html.slice(
      html.indexOf('data-match-id="m1"'),
      html.indexOf('data-match-id="m2"'),
    );
    const blocks = elements(card, "team-goals");
    expect(blocks).toHaveLength(2);
    expect(blocks.map((b) => b.match(/data-team="(\w+)"/)?.[1])).toEqual([
      "home",
      "away",
    ]);
    // Always open: no fold state, no toggle.
    for (const b of blocks) {
      expect(b).not.toContain("data-expanded");
      expect(b).not.toContain("aria-expanded");
    }
    expect(card).not.toContain('role="button"');
    // Between the names: home name < home block < away name < away block.
    const homeName = card.indexOf("Deportivo ABANCA");
    const awayName = card.indexOf("FC Barcelona Femení");
    const homeBlock = card.indexOf('data-team="home"');
    const awayBlock = card.indexOf('data-testid="team-goals" data-team="away"');
    expect(homeName).toBeLessThan(homeBlock);
    expect(homeBlock).toBeLessThan(awayName);
    expect(awayName).toBeLessThan(awayBlock);
    // No gaps: the second match has no block.
    expect(elements(html, "team-goals")).toHaveLength(2);
  });

  it("renders every goal-line with the very same HTML as MatchRow does", () => {
    const row: XornadaRow = {
      matchId: "m1" as MatchId,
      status: "live",
      qualifier: "confirmado",
      home: "Deportivo ABANCA",
      away: "FC Barcelona Femení",
      homeGalician: true,
      awayGalician: false,
      score: { home: 1, away: 2 } as Score,
      margin: { kind: "minute", minute: 68, addedMinute: null },
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
      goals: GOALS,
    };
    for (const locale of ["gl", "es"] as const) {
      const fromRow = elements(
        renderToStaticMarkup(createElement(MatchRow, { row, locale })),
        "goal-line",
      );
      const fromDirectos = elements(renderDirectos(locale), "goal-line");
      expect(fromRow).toHaveLength(3);
      expect(fromDirectos).toEqual(fromRow);
    }
  });

  it("drops the goals box, its rule and the emoji", () => {
    const html = renderDirectos();
    expect(html).not.toContain("⚽");
    expect(html).not.toContain('data-testid="match-goals"');
    expect(html).not.toMatch(/goalsBox|goalItem|goalPenalty/);
  });
});

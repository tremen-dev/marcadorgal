import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Instant, MatchId, Score } from "@/model";
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

describe("MatchRow Embedded Goals (SPEC-055 & SPEC-056)", () => {
  it("renders goals when provided on the row with collapsible drawer and team grouping", () => {
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

    // CA-1: Interactive attributes and affordance
    expect(html).toContain('data-has-goals="true"');
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('data-testid="goals-affordance"');
    expect(html).toContain("▸");

    // CA-2: Drawer, separation by team and minute formatting
    expect(html).toContain('data-testid="match-goals"');
    expect(html).toContain('data-team="home"');
    expect(html).toContain('data-team="away"');
    expect(html).toContain("Deportivo ABANCA");
    expect(html).toContain("FC Barcelona Femení");
    expect(html).toContain("Millene");
    expect(html).toContain("23");
    expect(html).toContain("(p.)");
    expect(html).toContain("Alexia");
    expect(html).toContain("45");
    expect(html).toContain("Aitana");
    expect(html).toContain("61");
    expect(html).toContain("(p.p.)");
  });

  it("does not render match-goals nor interactive button role when row has no goals", () => {
    const row = mockRow({ goals: [] });
    const html = renderToStaticMarkup(
      createElement(MatchRow, {
        row,
        locale: "gl",
      }),
    );

    expect(html).not.toContain('data-testid="match-goals"');
    expect(html).not.toContain('data-has-goals="true"');
    expect(html).not.toContain('role="button"');
    expect(html).not.toContain('data-testid="goals-affordance"');
  });

  it("marks the latest goal of a recently scored side with GOL badge (SPEC-056 CA-3)", () => {
    const now = Date.parse("2026-11-08T18:30:00.000Z");
    const oneMinAgo = new Date(now - 60_000).toISOString() as Instant;

    const row = mockRow({
      homeScoredAt: oneMinAgo,
      score: { home: 2, away: 1 } as Score,
      goals: [
        { team: "home", player: "Millene", minute: 23 },
        { team: "home", player: "Ainhoa Marín", minute: 73 },
        { team: "away", player: "Alexia", minute: 45 },
      ],
    });

    const html = renderToStaticMarkup(
      createElement(MatchRow, {
        row,
        locale: "gl",
        recentGoal: {
          now,
          minutes: 5,
          mark: "box",
        },
      }),
    );

    expect(html).toContain('data-testid="recent-scorer-badge"');
    expect(html).toContain("GOL");

    // The second goal (Ainhoa Marín at 73') is the latest for home, so it is marked recent
    expect(html).toMatch(
      /data-team="home"[^>]*data-recent="true"[^>]*>.*Ainhoa Marín.*73/s,
    );

    // The first goal (Millene at 23') is not the latest home goal
    expect(html).not.toMatch(
      /data-team="home"[^>]*data-recent="true"[^>]*>.*Millene.*23/s,
    );

    // Away team has not scored recently
    expect(html).not.toMatch(/data-team="away"[^>]*data-recent="true"/s);
  });

  it("renders localized aria-label in gl and es", () => {
    const row = mockRow({
      goals: [{ team: "home", player: "Millene", minute: 23 }],
    });

    const htmlGl = renderToStaticMarkup(
      createElement(MatchRow, { row, locale: "gl" }),
    );
    expect(htmlGl).toContain("Despregar goleadores");

    const htmlEs = renderToStaticMarkup(
      createElement(MatchRow, { row, locale: "es" }),
    );
    expect(htmlEs).toContain("Desplegar goleadores");
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

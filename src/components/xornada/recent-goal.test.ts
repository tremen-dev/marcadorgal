import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { es } from "@/i18n/es";
import { gl } from "@/i18n/gl";
import { PublicMatch } from "@/model";
import { applyDelta, boardMatches, initialBoard } from "@/xornada/live";
import { RECENT_GOAL_MARKS, type RecentGoalMark } from "@/xornada/recent-goal";
import { buildXornada } from "@/xornada/view";
import { MatchRow } from "./MatchRow";

// SPEC-041 CA-4 (H-4): the recent number, in both variants and languages:
// data-recent-goal, the words for screen readers, the pulse that stops on
// its own; box or the «GOL» pill. No state colour.

const LOCALES = [
  ["gl", gl],
  ["es", es],
] as const;

const NOW = Date.parse("2026-10-03T17:00:00Z");
const ONE_MIN_AGO = "2026-10-03T16:59:00.000Z";
const SIX_MIN_AGO = "2026-10-03T16:54:00.000Z";

function match(
  homeScoredAt: string | null,
  awayScoredAt: string | null,
  version = 3,
): PublicMatch {
  return PublicMatch.parse({
    matchId: "m-1",
    competitionId: "primera-division",
    competitionName: "Primeira División",
    tier: 1,
    round: 8,
    kickoff: "2026-10-03T16:00:00Z",
    home: { name: "RC Celta", shortName: "Celta" },
    away: { name: "Real Madrid", shortName: null },
    status: "live",
    score: { home: 2, away: 1 },
    minute: 60,
    addedMinute: null,
    halfTime: false,
    qualifier: "confirmado",
    version,
    observedAt: "2026-10-03T16:59:00Z",
    decidedAt: "2026-10-03T16:59:02Z",
    homeScoredAt,
    awayScoredAt,
  });
}

function html(
  m: PublicMatch,
  locale: "gl" | "es",
  mark: RecentGoalMark,
  now = NOW,
): string {
  const [competition] = buildXornada([m]);
  return renderToStaticMarkup(
    createElement(
      "ul",
      null,
      createElement(MatchRow, {
        row: competition.rows[0],
        locale,
        recentGoal: { now, minutes: 5, mark },
      }),
    ),
  );
}

// The score spans, in order (home, away), with their attributes.
const scores = (h: string): string[] =>
  [...h.matchAll(/<span[^>]*data-testid="score"[^>]*>/g)].map((m) => m[0]);
const marked = (h: string): boolean[] =>
  scores(h).map((s) => s.includes("data-recent-goal"));
const tags = (h: string): string[] =>
  [
    ...h.matchAll(
      /<span[^>]*data-testid="recent-goal-tag"[^>]*>([^<]*)<\/span>/g,
    ),
  ].map((m) => m[0]);

const CASES = [
  ["home", ONE_MIN_AGO, null, [true, false]],
  ["away", null, ONE_MIN_AGO, [false, true]],
  ["both", ONE_MIN_AGO, ONE_MIN_AGO, [true, true]],
  ["none (null)", null, null, [false, false]],
  ["none (6 min ago)", SIX_MIN_AGO, null, [false, false]],
] as const;

describe.each(RECENT_GOAL_MARKS)(
  "SPEC-041 CA-4 MatchRow, variant %s",
  (mark) => {
    describe.each(LOCALES)("%s", (locale, dict) => {
      it.each(CASES)("%s", (_name, home, away, expected) => {
        const h = html(match(home, away), locale, mark);
        expect(marked(h)).toEqual(expected);
        const n = expected.filter(Boolean).length;
        // The words, once per marked number, for screen readers only.
        const words = [
          ...h.matchAll(
            new RegExp(
              `<span class="[^"]*srOnly[^"]*">${dict.xornada.recentGoal}</span>`,
              "g",
            ),
          ),
        ];
        expect(words).toHaveLength(n);
        for (const s of scores(h).filter((s) =>
          s.includes("data-recent-goal"),
        )) {
          // 1 s pulses, one per second left: 4 min = 240 s.
          expect(s).toMatch(/class="[^"]*recentGoal[^"]*"/);
          expect(s).toContain("animation-iteration-count:240");
          if (mark === "box") expect(s).toMatch(/recentGoalBox/);
          else expect(s).not.toMatch(/recentGoalBox/);
          // No state colour: ember is live's (ADR-005).
          expect(s).not.toMatch(/ember|amber|red/);
        }
        if (mark === "label") {
          expect(tags(h)).toHaveLength(n);
          for (const t of tags(h)) {
            expect(t).toContain('aria-hidden="true"');
            expect(t).toContain(`>${dict.xornada.recentGoalLabel}<`);
          }
          expect(h).toMatch(/class="[^"]*sidesTag[^"]*"/);
        } else {
          expect(tags(h)).toHaveLength(0);
          expect(h).not.toMatch(/sidesTag/);
        }
        // The numbers are still the numbers.
        const numbers = [
          ...h.matchAll(/data-testid="score"[^>]*>([^<]*)<\/span>/g),
        ].map((m) => m[1]);
        expect(numbers).toEqual(["2", "1"]);
      });

      it("the pill sits between the name and the number of the side that scored", () => {
        if (mark !== "label") return;
        const h = html(match(null, ONE_MIN_AGO), locale, mark);
        const away = h.indexOf("Real Madrid");
        const tag = h.indexOf('data-testid="recent-goal-tag"');
        const score = h.indexOf('data-recent-goal=""');
        expect(away).toBeLessThan(tag);
        expect(tag).toBeLessThan(score);
      });
    });

    it("without the settings, no row is ever marked", () => {
      const [competition] = buildXornada([match(ONE_MIN_AGO, ONE_MIN_AGO)]);
      const h = renderToStaticMarkup(
        createElement(MatchRow, { row: competition.rows[0], locale: "gl" }),
      );
      expect(h).not.toContain("data-recent-goal");
    });
  },
);

// SPEC-041 CA-5: the client's state is the same reducer; a newer PublicMatch
// with the instant at null takes the mark away when painted, a new instant
// starts it.
describe("SPEC-041 CA-5 a new PublicMatch repaints the mark", () => {
  const paint = (board: ReturnType<typeof initialBoard>) =>
    html(boardMatches(board)[0], "gl", "box");

  it("null (disallowed) takes it away; a new instant brings it back", () => {
    let board = initialBoard([match(ONE_MIN_AGO, null, 3)], []);
    expect(marked(paint(board))).toEqual([true, false]);
    board = applyDelta(board, match(null, null, 4), NOW).board;
    expect(marked(paint(board))).toEqual([false, false]);
    board = applyDelta(
      board,
      match(null, "2026-10-03T16:59:30.000Z", 5),
      NOW,
    ).board;
    const h = paint(board);
    expect(marked(h)).toEqual([false, true]);
    expect(h).toContain("animation-iteration-count:270");
  });
});

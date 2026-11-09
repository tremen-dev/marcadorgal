import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { es } from "@/i18n/es";
import { gl } from "@/i18n/gl";
import type { Instant, MatchId, PublicGoal, Score } from "@/model";
import type { XornadaRow } from "@/xornada/view";
import { MatchRow, type RecentGoalView } from "./MatchRow.tsx";

const MATCH_ID = "liga-f-2026-27-j9-depor-abanca-barcelona" as MatchId;

const mockRow = (overrides?: Partial<XornadaRow>): XornadaRow => ({
  matchId: MATCH_ID,
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

const render = (
  row: XornadaRow,
  locale: "gl" | "es" = "gl",
  recentGoal?: RecentGoalView,
) => renderToStaticMarkup(createElement(MatchRow, { row, locale, recentGoal }));

// The outer HTML of every element with the given data-testid, in DOM order.
// Elements of one kind never nest, so the first closing tag of the same name
// after the opening one is the right one.
function elements(html: string, testId: string): string[] {
  const out: string[] = [];
  const open = new RegExp(`<(\\w+)[^>]*data-testid="${testId}"[^>]*>`, "g");
  for (const m of html.matchAll(open)) {
    const tag = m[1];
    const start = m.index ?? 0;
    // Nested same-name tags: count depth.
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

const attr = (el: string, name: string): string | null => {
  const m = el.match(new RegExp(`^<[^>]*\\s${name}="([^"]*)"`));
  return m ? m[1] : null;
};

const text = (el: string): string =>
  el
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&");

const count = (html: string, needle: string): number =>
  html.split(needle).length - 1;

const GOALS: PublicGoal[] = [
  { team: "home", player: "Millene", minute: 23, penalty: true },
  { team: "away", player: "Alexia Putellas", minute: 45 },
  { team: "away", player: "Aitana Bonmatí", minute: 61, ownGoal: true },
];

describe("SPEC-068 CA-1 every list hangs from its team", () => {
  it("puts each block right after its team's score inside .sides, the home one before the away name", () => {
    const html = render(mockRow({ goals: GOALS }));
    const blocks = elements(html, "team-goals");
    expect(blocks).toHaveLength(2);
    expect(blocks.map((b) => attr(b, "data-team"))).toEqual(["home", "away"]);
    expect(attr(blocks[0], "id")).toBe(`goals-${MATCH_ID}-home`);
    expect(attr(blocks[1], "id")).toBe(`goals-${MATCH_ID}-away`);

    // Vitest names CSS module classes `_sides_<hash>`.
    const sidesOpen = html.search(/<div class="[^"]*_sides_/);
    const names = [...html.matchAll(/data-testid="team-name"/g)].map(
      (m) => m.index ?? -1,
    );
    const scores = [...html.matchAll(/data-testid="score"/g)].map(
      (m) => m.index ?? -1,
    );
    const homeBlock = html.indexOf(`id="goals-${MATCH_ID}-home"`);
    const awayBlock = html.indexOf(`id="goals-${MATCH_ID}-away"`);
    expect(sidesOpen).toBeGreaterThan(-1);
    expect(names).toHaveLength(2);
    expect(scores).toHaveLength(2);
    // home name < home score < home block < away name < away score < away block
    expect(sidesOpen).toBeLessThan(names[0]);
    expect(names[0]).toBeLessThan(scores[0]);
    expect(scores[0]).toBeLessThan(homeBlock);
    expect(homeBlock).toBeLessThan(names[1]);
    expect(names[1]).toBeLessThan(scores[1]);
    expect(scores[1]).toBeLessThan(awayBlock);
    // The away block is still inside .sides: nothing closes the row's grid
    // between the sides and it (the next sibling of .sides, if any, is rowAge).
    const sidesClose = html.indexOf("</div>", awayBlock);
    expect(sidesClose).toBeGreaterThan(awayBlock);
  });

  it("emits no block for a team without goals", () => {
    const html = render(
      mockRow({ goals: [{ team: "away", player: "Alexia", minute: 45 }] }),
    );
    const blocks = elements(html, "team-goals");
    expect(blocks).toHaveLength(1);
    expect(attr(blocks[0], "data-team")).toBe("away");
    expect(html).not.toContain(`id="goals-${MATCH_ID}-home"`);
  });

  it("has no ⚽, no match-goals and no team name outside its team-name and the aria-label", () => {
    const row = mockRow({ goals: GOALS });
    const html = render(row);
    expect(html).not.toContain("⚽");
    expect(html).not.toContain('data-testid="match-goals"');
    // Once in the aria-label, once in the team-name span.
    expect(count(html, row.home)).toBe(2);
    expect(count(html, row.away)).toBe(2);
    for (const name of elements(html, "team-name"))
      expect([row.home, row.away]).toContain(text(name));
  });
});

describe("SPEC-068 CA-2 minute first, whole name, ordered by minute", () => {
  it("gives every line its minute first, as {minute}', and the player as it comes", () => {
    const html = render(
      mockRow({
        goals: [
          {
            team: "home",
            player: "FRANCISCO JOSÉ sánchez-rodríguez da Silva",
            minute: 7,
          },
        ],
      }),
    );
    const lines = elements(html, "goal-line");
    expect(lines).toHaveLength(1);
    const minute = elements(lines[0], "goal-minute");
    const player = elements(lines[0], "goal-player");
    expect(minute).toHaveLength(1);
    expect(player).toHaveLength(1);
    expect(text(minute[0])).toBe("7'");
    expect(text(player[0])).toBe("FRANCISCO JOSÉ sánchez-rodríguez da Silva");
    expect(lines[0].indexOf('data-testid="goal-minute"')).toBeLessThan(
      lines[0].indexOf('data-testid="goal-player"'),
    );
    expect(attr(lines[0], "data-team")).toBe("home");
  });

  it("orders the lines of a block by minute ascending, arrival order on a tie, whatever the arrival order", () => {
    const html = render(
      mockRow({
        goals: [
          { team: "away", player: "Alexia", minute: 45 },
          { team: "home", player: "Tercera", minute: 88 },
          { team: "home", player: "Primera", minute: 12 },
          { team: "home", player: "Segunda A", minute: 40 },
          { team: "home", player: "Segunda B", minute: 40 },
          { team: "home", player: "Cero", minute: 0 },
        ],
      }),
    );
    const [homeBlock, awayBlock] = elements(html, "team-goals");
    const order = (block: string) =>
      elements(block, "goal-line").map((l) => [
        text(elements(l, "goal-minute")[0]),
        text(elements(l, "goal-player")[0]),
      ]);
    expect(order(homeBlock)).toEqual([
      ["0'", "Cero"],
      ["12'", "Primera"],
      ["40'", "Segunda A"],
      ["40'", "Segunda B"],
      ["88'", "Tercera"],
    ]);
    expect(order(awayBlock)).toEqual([["45'", "Alexia"]]);
    for (const line of elements(homeBlock, "goal-line"))
      expect(attr(line, "data-team")).toBe("home");
  });
});

describe("SPEC-068 CA-3 penalty and own goal as a grey note", () => {
  it("adds goal-kind after the player with the i18n text of gl and es", () => {
    const row = mockRow({
      goals: [
        { team: "home", player: "Millene", minute: 23, penalty: true },
        { team: "home", player: "Aitana", minute: 61, ownGoal: true },
        { team: "home", player: "Alexia", minute: 70 },
      ],
    });
    for (const locale of ["gl", "es"] as const) {
      const dict = locale === "gl" ? gl : es;
      const lines = elements(render(row, locale), "goal-line");
      expect(lines).toHaveLength(3);
      const kinds = lines.map((l) => elements(l, "goal-kind"));
      expect(kinds.map((k) => k.length)).toEqual([1, 1, 0]);
      expect(text(kinds[0][0])).toBe(dict.xornada.goalPenalty);
      expect(text(kinds[1][0])).toBe(dict.xornada.goalOwnGoal);
      // After the player, and the player's text stays whole.
      expect(lines[0].indexOf('data-testid="goal-player"')).toBeLessThan(
        lines[0].indexOf('data-testid="goal-kind"'),
      );
      expect(text(elements(lines[0], "goal-player")[0])).toBe("Millene");
    }
    expect(gl.xornada.goalPenalty).toBe("(p.)");
    expect(gl.xornada.goalOwnGoal).toBe("(p.p.)");
    expect(es.xornada.goalPenalty).toBe("(p.)");
    expect(es.xornada.goalOwnGoal).toBe("(p.p.)");
  });
});

describe("SPEC-056 kept: affordance, button role and localized label", () => {
  it("renders the affordance and the button role when the row has goals", () => {
    const html = render(mockRow({ goals: GOALS }));
    expect(html).toContain('data-has-goals="true"');
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('data-testid="goals-affordance"');
    expect(html).toContain("▸");
  });

  it("renders no block nor interactive role when the row has no goals", () => {
    for (const goals of [[], undefined]) {
      const html = render(mockRow({ goals }));
      expect(html).not.toContain('data-testid="team-goals"');
      expect(html).not.toContain('data-has-goals="true"');
      expect(html).not.toContain('role="button"');
      expect(html).not.toContain("aria-controls");
      expect(html).not.toContain('data-testid="goals-affordance"');
    }
  });

  it("renders localized aria-label in gl and es", () => {
    const row = mockRow({ goals: GOALS });
    expect(render(row, "gl")).toContain("Despregar goleadores");
    expect(render(row, "es")).toContain("Desplegar goleadores");
  });

  it("renders half-time state correctly", () => {
    const html = render(
      mockRow({ margin: { kind: "halfTime" }, part: "halfTime" }),
    );
    expect(html).toContain("DESCANSO");
  });
});

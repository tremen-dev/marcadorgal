import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  GOAL_ANNULLED_TEMPLATES,
  GOAL_TEMPLATES,
  type SocialTemplate,
} from "../i18n/social.gl.ts";
import { renderSocialText, type SocialTextInput } from "./text.ts";

// SPEC-066 CA-8 (ADR-030 §6, D-2): the templates of the account, in galego,
// and the one renderer. Every assertion runs over every template.

const ALL: readonly SocialTemplate[] = [
  ...GOAL_TEMPLATES,
  ...GOAL_ANNULLED_TEMPLATES,
];

const base: SocialTextInput = {
  team: "RC Celta",
  home: "RC Celta",
  away: "RC Deportivo",
  score: { home: 2, away: 1 },
  minute: 45,
  addedMinute: 2,
  link: null,
};

// The longest Team.name of the declared season, straight from data/.
const root = path.resolve(__dirname, "../..");
const longest = readdirSync(path.join(root, "data/calendario/2026-27"))
  .filter((f) => f.endsWith(".json"))
  .flatMap((f) => {
    const json = JSON.parse(
      readFileSync(path.join(root, "data/calendario/2026-27", f), "utf8"),
    ) as { teams: { name: string }[] };
    return json.teams.map((t) => t.name);
  })
  .sort((a, b) => b.length - a.length)[0];

describe("SPEC-066 CA-8 the templates", () => {
  it("there are at least 5 of goal and 3 of goal_annulled, with unique ids", () => {
    expect(GOAL_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    expect(GOAL_ANNULLED_TEMPLATES.length).toBeGreaterThanOrEqual(3);
    const ids = ALL.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^(goal|annulled)-\d+$/);
  });

  it.each(ALL.map((t) => [t.id, t] as const))(
    "%s carries both names untouched, the score and the minute as on screen",
    (_, template) => {
      const text = renderSocialText(template, base);
      expect(text).toContain("RC Celta");
      expect(text).toContain("RC Deportivo");
      expect(text).toContain("2-1");
      expect(text).toContain("45+2'");
      expect(text).not.toContain("@");
      expect(text).not.toMatch(/\{\w+\}/);
    },
  );

  it.each(ALL.map((t) => [t.id, t] as const))(
    "%s never puts {team} after a contraction (do, da, ao, á, no, na)",
    (_, template) => {
      expect(template.text).not.toMatch(/\b(do|da|ao|á|no|na)\s+\{team\}/iu);
      expect(template.text).toContain("{team}");
      expect(template.text).not.toContain("@");
    },
  );

  it.each(ALL.map((t) => [t.id, t] as const))(
    "%s without a minute leaves no null, no loose quote and no empty line",
    (_, template) => {
      const text = renderSocialText(template, {
        ...base,
        minute: null,
        addedMinute: null,
      });
      expect(text).not.toMatch(/null|undefined/);
      expect(text).not.toMatch(/(?<!\d)'/);
      expect(text).not.toMatch(/\n\s*\n/);
      expect(text).not.toMatch(/\(\s*\)/);
      expect(text).not.toMatch(/[ \t]\n|[ \t]$/);
      expect(text).toContain("2-1");
      // A plain minute, without added time, reads 46'.
      expect(
        renderSocialText(template, { ...base, minute: 46, addedMinute: null }),
      ).toContain("46'");
    },
  );

  it.each(ALL.map((t) => [t.id, t] as const))(
    "%s stays within 250 characters with the longest names and the link",
    (_, template) => {
      const text = renderSocialText(template, {
        team: longest,
        home: longest,
        away: longest,
        score: { home: 10, away: 10 },
        minute: 120,
        addedMinute: 15,
        link: "https://marcador.gal/xornada/2026-11-07",
      });
      expect(longest.length).toBeGreaterThanOrEqual(20);
      expect(text.length).toBeLessThanOrEqual(250);
      expect(text.endsWith("\nhttps://marcador.gal/xornada/2026-11-07")).toBe(
        true,
      );
    },
  );
});

describe("SPEC-066 CA-8 renderSocialText", () => {
  it("renders the tokens and the optional minute segment", () => {
    const template: SocialTemplate = {
      id: "goal-0",
      text: "GOL! {team}[ ({minute})]\n{home} {score} {away}",
    };
    expect(renderSocialText(template, base)).toBe(
      "GOL! RC Celta (45+2')\nRC Celta 2-1 RC Deportivo",
    );
    expect(
      renderSocialText(template, { ...base, minute: null, addedMinute: null }),
    ).toBe("GOL! RC Celta\nRC Celta 2-1 RC Deportivo");
  });

  it("appends the link as the last line only when there is one", () => {
    const template: SocialTemplate = { id: "goal-0", text: "{team} {score}" };
    expect(
      renderSocialText(template, { ...base, link: "https://marcador.gal" }),
    ).toBe("RC Celta 2-1\nhttps://marcador.gal");
    expect(renderSocialText(template, base)).toBe("RC Celta 2-1");
  });

  it("refuses an unknown token: a typo in a template is a test failure, not a tweet", () => {
    const template: SocialTemplate = { id: "goal-0", text: "{teem} {score}" };
    expect(() => renderSocialText(template, base)).toThrow(/teem/);
  });
});

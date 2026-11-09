import type { SocialTemplate } from "../i18n/social.gl.ts";
import type { Score } from "../model/index.ts";

// SPEC-066 CA-8 (ADR-030 §6): the one renderer of the templates of
// src/i18n/social.gl.ts. Pure: names and score come from the Decision and
// the teams, the link from the configuration (CA-10), the minute as on
// screen (SPEC-019: 45+2', never folded).

export type SocialTextInput = {
  // Team.name of the side the row is about, and of both sides (D-2).
  team: string;
  home: string;
  away: string;
  score: Score;
  minute: number | null;
  addedMinute: number | null;
  // The last line of the text when the configuration has one.
  link: string | null;
};

// «45+3'» and «46'»: the same label the screen prints (src/xornada/view.ts
// minuteLabel), without importing the view into the social side.
export function minuteLabel(minute: number, addedMinute: number | null) {
  return addedMinute === null ? `${minute}'` : `${minute}+${addedMinute}'`;
}

const TOKEN = /\{(\w+)\}/g;
const OPTIONAL = /\[([^\]]*)\]/g;

export function renderSocialText(
  template: SocialTemplate,
  input: SocialTextInput,
): string {
  const minute =
    input.minute === null ? null : minuteLabel(input.minute, input.addedMinute);
  const values: Record<string, string> = {
    team: input.team,
    home: input.home,
    away: input.away,
    score: `${input.score.home}-${input.score.away}`,
    ...(minute === null ? {} : { minute }),
  };
  // A bracketed segment only survives with a minute.
  const withSegments = template.text.replace(OPTIONAL, (_, inner: string) =>
    minute === null ? "" : inner,
  );
  const body = withSegments.replace(TOKEN, (_, name: string) => {
    const value = values[name];
    if (value === undefined)
      throw new Error(
        `social template ${template.id}: unknown token {${name}}`,
      );
    return value;
  });
  return input.link === null ? body : `${body}\n${input.link}`;
}

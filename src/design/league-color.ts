import { LEAGUE_COLORS } from "./tokens";

// SPEC-083 CA-2: the colour of a league is its token of SPEC-057
// (LEAGUE_COLORS), painted through its CSS variable. Undefined for an id
// without a token, so the caller picks its own fallback.
export function leagueColor(id: string): string | undefined {
  const token = (LEAGUE_COLORS as Record<string, { css: string } | undefined>)[
    id
  ];
  return token ? `var(${token.css})` : undefined;
}

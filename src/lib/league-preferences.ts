// SPEC-057: Preferencias de competiciones visibles en portada y persistencia en localStorage.

import { LEAGUE_COLORS, type LeagueColorToken } from "@/design/tokens";
import type { TranslationKey } from "@/i18n";

export const LEAGUES_PREFERENCES_KEY =
  "marcadorgal:preferences:visible-leagues:v1";
export const LEAGUES_PREFERENCE_EVENT = "marcadorgal:leagues-preference-change";

export interface CompetitionPreferenceItem {
  id: LeagueColorToken;
  // SPEC-057 CA-3: the switch's name, resolved in the page's language.
  nameKey: `competitions.names.${LeagueColorToken}` & TranslationKey;
  featuredBadge?: string;
  category: "femenino" | "masculino";
  // SPEC-057 CA-6: the CSS variable of the league's token (tokens.ts).
  color: string;
}

const item = (
  id: LeagueColorToken,
  category: CompetitionPreferenceItem["category"],
  featuredBadge?: string,
): CompetitionPreferenceItem => ({
  id,
  nameKey: `competitions.names.${id}`,
  category,
  color: `var(${LEAGUE_COLORS[id].css})`,
  ...(featuredBadge ? { featuredBadge } : {}),
});

export const KNOWN_COMPETITIONS: readonly CompetitionPreferenceItem[] = [
  item("liga-f", "femenino", "Depor ABANCA"),
  item("primera-federacion-fem", "femenino"),
  item("segunda-federacion-fem-g1", "femenino", "As Celtas"),
  item("primera-division", "masculino"),
  item("segunda-division", "masculino"),
  item("primera-rfef-g1", "masculino"),
  item("segunda-rfef-g1", "masculino"),
  item("tercera-rfef-g1", "masculino"),
];

export const ALL_COMPETITION_IDS: readonly string[] = KNOWN_COMPETITIONS.map(
  (c) => c.id,
);

export const PRESET_IDS = {
  all: ALL_COMPETITION_IDS,
  women: KNOWN_COMPETITIONS.filter((c) => c.category === "femenino").map(
    (c) => c.id,
  ),
  modest: ["primera-rfef-g1", "segunda-rfef-g1", "tercera-rfef-g1"],
  pro: ["primera-division", "segunda-division"],
} as const;

// SPEC-057 CA-5: merely touching window.localStorage may throw
// (SecurityError when the browser blocks storage), so it is inside the try.
export function getStoredVisibleCompetitions(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    if (!window.localStorage) return null;
    const raw = window.localStorage.getItem(LEAGUES_PREFERENCES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every((x) => typeof x === "string")
    ) {
      return parsed;
    }
  } catch (_e) {
    // Ignore invalid JSON or access issues
  }
  return null;
}

export function saveStoredVisibleCompetitions(ids: readonly string[]): void {
  if (typeof window === "undefined") return;
  try {
    if (!window.localStorage) return;
    window.localStorage.setItem(LEAGUES_PREFERENCES_KEY, JSON.stringify(ids));
    window.dispatchEvent(
      new CustomEvent(LEAGUES_PREFERENCE_EVENT, { detail: ids }),
    );
  } catch (_e) {
    // Ignore storage quota or security errors
  }
}

export function applyVisibleCompetitionsToDom(
  visibleIds: readonly string[],
  root: Document | HTMLElement = document,
): void {
  const sections = root.querySelectorAll<HTMLElement>(
    "section[data-competition]",
  );
  for (const section of sections) {
    const id = section.dataset.competition;
    if (!id) continue;
    if (visibleIds.includes(id)) {
      section.removeAttribute("data-user-hidden");
    } else {
      section.setAttribute("data-user-hidden", "true");
    }
  }
}

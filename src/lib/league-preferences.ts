// SPEC-057: Preferencias de competiciones visibles en portada y persistencia en localStorage.

export const LEAGUES_PREFERENCES_KEY =
  "marcadorgal:preferences:visible-leagues:v1";
export const LEAGUES_PREFERENCE_EVENT = "marcadorgal:leagues-preference-change";

export interface CompetitionPreferenceItem {
  id: string;
  nameKey: string;
  defaultName: string;
  featuredBadge?: string;
  category: "femenino" | "masculino";
  colorRgb: string;
}

export const KNOWN_COMPETITIONS: readonly CompetitionPreferenceItem[] = [
  {
    id: "liga-f",
    nameKey: "competitions.liga-f",
    defaultName: "Liga F Moeve",
    featuredBadge: "Depor ABANCA",
    category: "femenino",
    colorRgb: "rgb(228, 0, 124)",
  },
  {
    id: "primera-federacion-fem",
    nameKey: "competitions.primera-federacion-fem",
    defaultName: "1ª Federación Fem.",
    category: "femenino",
    colorRgb: "rgb(162, 28, 175)",
  },
  {
    id: "segunda-federacion-fem-g1",
    nameKey: "competitions.segunda-federacion-fem-g1",
    defaultName: "2ª Federación Fem. G1",
    featuredBadge: "As Celtas",
    category: "femenino",
    colorRgb: "rgb(124, 58, 237)",
  },
  {
    id: "primera-division",
    nameKey: "competitions.primera-division",
    defaultName: "Primeira División",
    category: "masculino",
    colorRgb: "rgb(239, 68, 68)",
  },
  {
    id: "segunda-division",
    nameKey: "competitions.segunda-division",
    defaultName: "Segunda División",
    category: "masculino",
    colorRgb: "rgb(59, 130, 246)",
  },
  {
    id: "primera-rfef-g1",
    nameKey: "competitions.primera-rfef-g1",
    defaultName: "1ª RFEF G1",
    category: "masculino",
    colorRgb: "rgb(16, 185, 129)",
  },
  {
    id: "segunda-rfef-g1",
    nameKey: "competitions.segunda-rfef-g1",
    defaultName: "2ª RFEF G1",
    category: "masculino",
    colorRgb: "rgb(245, 158, 11)",
  },
  {
    id: "tercera-rfef-g1",
    nameKey: "competitions.tercera-rfef-g1",
    defaultName: "3ª RFEF G1",
    category: "masculino",
    colorRgb: "rgb(99, 102, 241)",
  },
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

export function getStoredVisibleCompetitions(): string[] | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
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
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
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

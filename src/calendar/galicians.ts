import primeraDivision2026 from "../../data/calendario/2026-27/primera-division.json";
import primeraRfef2026 from "../../data/calendario/2026-27/primera-rfef-g1.json";
import segundaDivision2026 from "../../data/calendario/2026-27/segunda-division.json";
import segundaRfef2026 from "../../data/calendario/2026-27/segunda-rfef-g1.json";
import terceraRfef2026 from "../../data/calendario/2026-27/tercera-rfef-g1.json";
import galegos2026 from "../../data/galegos/2026-27.json";
import { GalicianTeamsFile } from "../model/index.ts";

// SPEC-033 CA-4 (H-3): the Equipo galego of a season, resolved on the server
// from data/galegos/<season>.json to the names of the declared calendar.
// Bundled as JSON (no file reads at request time); the view matches rows by
// name, unique in the season (galicians.test.ts). A new season adds its line.
type Declared = {
  ids: unknown;
  calendars: readonly { teams: readonly { id: string; name: string }[] }[];
};

export const GALICIAN_SEASONS: Readonly<Record<string, Declared>> = {
  "2026-27": {
    ids: galegos2026,
    calendars: [
      primeraDivision2026,
      segundaDivision2026,
      primeraRfef2026,
      segundaRfef2026,
      terceraRfef2026,
    ],
  },
};

const cache = new Map<string, ReadonlySet<string>>();

// Every declared team, with no exception per competition (H-4). A season
// with no file has none.
export function galicianNames(season: string): ReadonlySet<string> {
  const cached = cache.get(season);
  if (cached) return cached;
  const declared = GALICIAN_SEASONS[season];
  const names = new Set<string>();
  if (declared) {
    const ids = new Set<string>(GalicianTeamsFile.parse(declared.ids));
    for (const calendar of declared.calendars)
      for (const team of calendar.teams)
        if (ids.has(team.id)) names.add(team.name);
  }
  cache.set(season, names);
  return names;
}

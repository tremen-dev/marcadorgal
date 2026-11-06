import { type CalendarImporter, CompetitionId } from "../model/index.ts";
import { apiFootballCalendar } from "../sources/api-football/calendar.ts";
import { rfefCalendar } from "../sources/rfef/calendar.ts";

// Registered calendar importers in priority order: rfef (via explorer) is now
// the primary official importer (ADR-026, SPEC-045).
export const IMPORTERS: readonly CalendarImporter[] = [
  rfefCalendar,
  apiFootballCalendar,
];

export function importerFor(sourceId: string): CalendarImporter | undefined {
  return IMPORTERS.find((i) => i.id === sourceId);
}

// The five competitions of D-3, in tier order; names are the draft ones of
// N-10 (the human corrects them in the JSON).
export const COMPETITIONS: readonly {
  id: CompetitionId;
  name: string;
  tier: 1 | 2 | 3 | 4 | 5;
}[] = [
  {
    id: CompetitionId.parse("primera-division"),
    name: "Primera División",
    tier: 1,
  },
  {
    id: CompetitionId.parse("segunda-division"),
    name: "Segunda División",
    tier: 2,
  },
  {
    id: CompetitionId.parse("primera-rfef-g1"),
    name: "Primera RFEF Grupo 1",
    tier: 3,
  },
  {
    id: CompetitionId.parse("segunda-rfef-g1"),
    name: "Segunda RFEF Grupo 1",
    tier: 4,
  },
  {
    id: CompetitionId.parse("tercera-rfef-g1"),
    name: "Tercera RFEF Grupo 1",
    tier: 5,
  },
];

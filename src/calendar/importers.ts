import type { CalendarImporter } from "../model/index.ts";
import { apiFootballCalendar } from "../sources/api-football/calendar.ts";

export const IMPORTERS: readonly CalendarImporter[] = [apiFootballCalendar];

export function importerFor(sourceId: string): CalendarImporter | undefined {
  return IMPORTERS.find((i) => i.id === sourceId);
}

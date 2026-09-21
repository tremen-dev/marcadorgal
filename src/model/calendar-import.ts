import { z } from "zod";
import type { CompetitionId, SourceId } from "./ids.ts";
import { Instant } from "./instant.ts";
import type { Season } from "./vocab.ts";

// What a calendar importer yields: external ids and names, nothing else from
// the provider (SPEC-004 N-6). Aliases map externalId to our TeamId.
export const ImportedTeam = z.strictObject({
  externalId: z.string().min(1),
  externalName: z.string().min(1),
});
export type ImportedTeam = z.infer<typeof ImportedTeam>;

export const ImportedMatch = z.strictObject({
  round: z.int().min(1),
  kickoff: Instant,
  home: z.string().min(1),
  away: z.string().min(1),
  timeConfirmed: z.boolean(),
});
export type ImportedMatch = z.infer<typeof ImportedMatch>;

export const ImportedCalendar = z.strictObject({
  teams: z.array(ImportedTeam),
  matches: z.array(ImportedMatch),
  ignoredRounds: z.record(z.string(), z.int().min(1)),
});
export type ImportedCalendar = z.infer<typeof ImportedCalendar>;

export type CalendarFetchContext = {
  apiKey: string;
  fetch: typeof fetch;
  userAgent: string;
};

export interface CalendarImporter {
  readonly id: SourceId;
  covers(
    competitionId: CompetitionId | string,
    season: Season | string,
  ): boolean;
  fetch(
    competitionId: CompetitionId | string,
    season: Season | string,
    ctx: CalendarFetchContext,
  ): Promise<unknown>;
  parse(raw: unknown): ImportedCalendar;
}

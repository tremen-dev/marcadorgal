import type { CompetitionCode } from "../model/index.ts";

// SPEC-089 CA-1: where each competition page takes its data from. An
// explicit map, not a heuristic (nota 1): `local` is the declared calendar of
// data/calendario, `explorer` is the scraper, `none` means marcador.gal has no
// official data and says so. Giving a `none` a source back needs a spec and
// real data.
export type CalendarSource = "local" | "explorer" | "none";
export type StandingsSource = "explorer" | "none";

export type CompetitionSources = {
  calendar: CalendarSource;
  standings: StandingsSource;
};

export const COMPETITION_SOURCES: Readonly<
  Record<CompetitionCode, CompetitionSources>
> = {
  "liga-f": { calendar: "explorer", standings: "explorer" },
  // Explorer generates a round-robin and fills the table with zeros.
  "primera-federacion-fem": { calendar: "none", standings: "none" },
  // SPEC-091 CA-2: the official calendar and table since 2026-11-17.
  "segunda-federacion-fem-g1": { calendar: "explorer", standings: "explorer" },
  "primera-division": { calendar: "local", standings: "explorer" },
  "segunda-division": { calendar: "local", standings: "explorer" },
  // CA-7: the MARCA table could not be shown to be the Group 1 (ledger);
  // one line to turn back to `explorer` once it can.
  "primera-rfef-g1": { calendar: "local", standings: "none" },
  // Not in MARCA's config: the table always fails.
  "segunda-rfef-g1": { calendar: "local", standings: "none" },
  // Explorer serves an empty table.
  "tercera-rfef-g1": { calendar: "local", standings: "none" },
};

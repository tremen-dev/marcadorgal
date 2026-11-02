import {
  type AliasEntry,
  type AliasFile,
  type CompetitionId,
  SourceId,
  type TeamId,
} from "../../model/index.ts";
import { normalizeName } from "./adapter.ts";

// The alias of the rfef (SPEC-038 CA-5, ADR-017 §2): the pure half of
// npm run alias:rfef. tools/alias-rfef.mjs reads the files and writes the
// result; nothing here touches the disk. The externalId of every entry is the
// normalized name, which is what createRfef and the explorer adapter look up.

export type CalendarTeams = {
  competitionId: CompetitionId;
  teams: readonly { id: TeamId; name: string }[];
};

export type BuildRfefAliasInput = {
  season: string;
  competitions: Readonly<Record<string, CompetitionId>>;
  // The declared calendar of the five competitions: the authority on names.
  calendars: readonly CalendarTeams[];
  // Entries already validated over real panels (alias-test.json, minus its
  // deliberate errors) and the entries of the current file (corrections by
  // hand), in that order of precedence after the calendar.
  validated: readonly AliasEntry[];
  existing: readonly AliasEntry[];
};

const byTeamThenId = (a: AliasEntry, b: AliasEntry) =>
  a.teamId < b.teamId
    ? -1
    : a.teamId > b.teamId
      ? 1
      : a.externalId < b.externalId
        ? -1
        : a.externalId > b.externalId
          ? 1
          : 0;

export function buildRfefAlias({
  season,
  competitions,
  calendars,
  validated,
  existing,
}: BuildRfefAliasInput): AliasFile {
  const known = new Set<string>(
    calendars.flatMap((c) => c.teams.map((t) => t.id)),
  );
  const byId = new Map<string, AliasEntry>();
  const names = new Set<string>();
  const add = (externalName: string, teamId: TeamId) => {
    const externalId = normalizeName(externalName);
    // First wins: the calendar, then the validated entries, then the file.
    if (!known.has(teamId) || byId.has(externalId) || names.has(externalName))
      return;
    byId.set(externalId, { externalId, externalName, teamId });
    names.add(externalName);
  };
  for (const calendar of calendars)
    for (const team of calendar.teams) add(team.name, team.id);
  for (const entry of validated) add(entry.externalName, entry.teamId);
  for (const entry of existing) add(entry.externalName, entry.teamId);

  return {
    source: SourceId.parse("rfef"),
    season: season as AliasFile["season"],
    competitions: { ...competitions },
    teams: [...byId.values()].sort(byTeamThenId),
  };
}

export type UnresolvedName = {
  codGrupo: string;
  competitionId: CompetitionId;
  name: string;
};

// The names of an export body (ADR-023 §4) in the mapped groups that the
// alias does not resolve, once each, in order of appearance. A body of
// another shape lists nothing: the contract itself is checked by explorer.ts.
export function unresolvedExportNames(
  file: AliasFile,
  body: unknown,
): UnresolvedName[] {
  const teams = new Set(file.teams.map((t) => t.externalId));
  const competitions = new Map(Object.entries(file.competitions ?? {}));
  const matches = (body as { matches?: unknown })?.matches;
  if (!Array.isArray(matches)) return [];
  const out: UnresolvedName[] = [];
  const seen = new Set<string>();
  for (const row of matches as Record<string, unknown>[]) {
    const codGrupo = String(row.codGrupo ?? "");
    const competitionId = competitions.get(codGrupo);
    if (competitionId === undefined) continue;
    for (const side of ["equipoLocal", "equipoVisitante"]) {
      const name = row[side];
      if (typeof name !== "string") continue;
      const key = `${codGrupo}|${normalizeName(name)}`;
      if (teams.has(normalizeName(name)) || seen.has(key)) continue;
      seen.add(key);
      out.push({ codGrupo, competitionId, name });
    }
  }
  return out;
}

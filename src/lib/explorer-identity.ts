import type { AliasFile } from "../model/index.ts";
import { normalizeName } from "../sources/rfef/adapter.ts";
import type { DayMatchesResponse } from "./explorer-client.ts";

// The identity of a row of the explorer export against a local match
// (SPEC-070), the one the rfef adapter already uses (ADR-017 §2, ADR-023 §5):
// the competition is competitions[codGrupo] of the rfef alias, or
// canonicalCompetitionId when the group is not in the map; each side is the
// team the alias gives the name, or else a canonical*TeamId equal to the id.
// No similar names, no substrings: what does not resolve does not pair.

export type ExplorerRow = DayMatchesResponse["matches"][number];

type Index = {
  teamByName: ReadonlyMap<string, string>;
  competitionOf: ReadonlyMap<string, string>;
};

const EMPTY: Index = { teamByName: new Map(), competitionOf: new Map() };
const indexes = new WeakMap<AliasFile, Index>();

function indexOf(aliases: AliasFile | null | undefined): Index {
  if (!aliases) return EMPTY;
  const cached = indexes.get(aliases);
  if (cached) return cached;
  const index: Index = {
    teamByName: new Map(
      aliases.teams.map((t) => [normalizeName(t.externalId), t.teamId]),
    ),
    competitionOf: new Map(Object.entries(aliases.competitions ?? {})),
  };
  indexes.set(aliases, index);
  return index;
}

export function rowCompetitionId(
  row: ExplorerRow,
  aliases: AliasFile | null | undefined,
): string | null {
  const byGroup =
    row.codGrupo !== undefined
      ? indexOf(aliases).competitionOf.get(row.codGrupo)
      : undefined;
  return byGroup ?? row.canonicalCompetitionId ?? null;
}

// A side resolves by the alias of its name; only a name the alias does not
// know falls back on the canonical id, which then has to be the id itself.
// An alias that says another team discards, whatever the canonical id says.
function sideTeamId(
  name: string | undefined,
  canonical: string | undefined,
  index: Index,
): string | null {
  const byAlias =
    name !== undefined ? index.teamByName.get(normalizeName(name)) : undefined;
  return byAlias ?? canonical ?? null;
}

export function rowTeamIds(
  row: ExplorerRow,
  aliases: AliasFile | null | undefined,
): { home: string | null; away: string | null } {
  const index = indexOf(aliases);
  return {
    home: sideTeamId(
      row.equipoLocal ?? row.homeTeam,
      row.canonicalHomeTeamId,
      index,
    ),
    away: sideTeamId(
      row.equipoVisitante ?? row.awayTeam,
      row.canonicalAwayTeamId,
      index,
    ),
  };
}

export type LocalIdentity = {
  competitionId: string;
  homeTeamId: string;
  awayTeamId: string;
};

export function isSameMatch(
  local: LocalIdentity,
  row: ExplorerRow,
  aliases: AliasFile | null | undefined,
): boolean {
  const competition = rowCompetitionId(row, aliases);
  if (competition === null || competition !== local.competitionId) return false;
  const { home, away } = rowTeamIds(row, aliases);
  return home === local.homeTeamId && away === local.awayTeamId;
}

// A public match carries no team ids: N-2 puts them after
// <competition>-<season>-j<round>-. Without both sides resolved the row
// cannot be compared against the suffix.
export function isSamePublicMatch(
  local: { matchId: string; competitionId: string; round: number },
  row: ExplorerRow,
  aliases: AliasFile | null | undefined,
): boolean {
  const competition = rowCompetitionId(row, aliases);
  if (competition === null || competition !== local.competitionId) return false;
  const prefix = `${local.competitionId}-`;
  if (!local.matchId.startsWith(prefix)) return false;
  const rest = local.matchId.slice(prefix.length);
  const m = /^\d{4}-\d{2}-j(\d+)-(.+)$/.exec(rest);
  if (!m || Number(m[1]) !== local.round) return false;
  const { home, away } = rowTeamIds(row, aliases);
  if (home === null || away === null) return false;
  return m[2] === `${home}-${away}`;
}

const madridTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Madrid",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// HH:MM of an instant in Europe/Madrid, as horaTexto writes it.
export function madridHour(instant: string): string {
  const ts = Date.parse(instant);
  if (Number.isNaN(ts)) return "";
  return madridTime.format(ts);
}

export type Candidate = {
  codActa: string | null;
  home: string | null;
  away: string | null;
};

export const candidateOf = (row: ExplorerRow): Candidate => ({
  codActa: row.codActa ?? null,
  home: row.equipoLocal ?? row.homeTeam ?? null,
  away: row.equipoVisitante ?? row.awayTeam ?? null,
});

export type Pairing =
  | { kind: "paired"; row: ExplorerRow }
  | { kind: "unpaired" }
  | { kind: "ambiguous"; candidates: ExplorerRow[] };

// Never the first that fits (SPEC-070 CA-5): one candidate pairs; two or
// more pair only if exactly one of them is at the declared kickoff hour.
export function pickRow(
  rows: readonly ExplorerRow[],
  isSame: (row: ExplorerRow) => boolean,
  kickoff: string,
): Pairing {
  const candidates = rows.filter(isSame);
  if (candidates.length === 0) return { kind: "unpaired" };
  if (candidates.length === 1)
    return { kind: "paired", row: candidates[0] as ExplorerRow };
  const hour = madridHour(kickoff);
  const onTime = candidates.filter((r) => r.horaTexto === hour);
  if (onTime.length === 1)
    return { kind: "paired", row: onTime[0] as ExplorerRow };
  return { kind: "ambiguous", candidates };
}

import {
  type Competition,
  type ImportedCalendar,
  type MatchId,
  SourceId,
  type Team,
  TeamId,
} from "../model/index.ts";
import { matchId } from "./match-id.ts";
import type {
  AliasEntry,
  AliasFile,
  CalendarFile,
  CalendarMatch,
} from "./schema.ts";

export type SyncInput = {
  current: CalendarFile | null;
  aliases: AliasFile;
  imported: ImportedCalendar;
  competition: Competition;
  sourceId: string;
};

export type SyncDiff = {
  newTeams: AliasEntry[];
  added: MatchId[];
  rescheduled: { id: MatchId; from: string; to: string }[];
  missing: MatchId[];
  renamedAtProvider: {
    externalId: string;
    from: string;
    to: string;
    teamId: string;
  }[];
  // A provider match id that now points at another derived match (rule g).
  rematched: { externalId: string; from: MatchId; to: MatchId }[];
  unconfirmed: MatchId[];
  ignoredRounds: Record<string, number>;
};

export type SyncResult = {
  calendar: CalendarFile;
  aliases: AliasFile;
  diff: SyncDiff;
};

// NFD without diacritics, lower case, hyphen-separated (CA-6 a).
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const byId = <T extends { id: string }>(a: T, b: T) => a.id.localeCompare(b.id);
const byExternalId = <T extends { externalId: string }>(a: T, b: T) =>
  a.externalId.localeCompare(b.externalId);
const byRoundKickoffHome = (a: CalendarMatch, b: CalendarMatch) =>
  a.round - b.round ||
  Date.parse(a.kickoff) - Date.parse(b.kickoff) ||
  a.home.localeCompare(b.home);

export function syncCalendar(input: SyncInput): SyncResult {
  const { current, imported, sourceId } = input;
  const competition = current?.competition ?? input.competition;
  const season = competition.season;

  const teams = new Map<TeamId, Team>(
    (current?.teams ?? []).map((t) => [t.id, t]),
  );
  const aliasEntries = input.aliases.teams.map((a) => ({ ...a }));
  const aliasByExternalId = new Map(aliasEntries.map((a) => [a.externalId, a]));
  const diff: SyncDiff = {
    newTeams: [],
    added: [],
    rescheduled: [],
    missing: [],
    renamedAtProvider: [],
    rematched: [],
    unconfirmed: [],
    ignoredRounds: { ...imported.ignoredRounds },
  };

  const freeSlug = (name: string): TeamId => {
    const base = slugify(name);
    let candidate = base;
    for (let n = 2; teams.has(candidate as TeamId); n++)
      candidate = `${base}-${n}`;
    return TeamId.parse(candidate);
  };

  const teamIdOf = new Map<string, TeamId>();
  for (const ext of [...imported.teams].sort(byExternalId)) {
    const alias = aliasByExternalId.get(ext.externalId);
    if (alias) {
      if (alias.externalName !== ext.externalName)
        diff.renamedAtProvider.push({
          externalId: ext.externalId,
          from: alias.externalName,
          to: ext.externalName,
          teamId: alias.teamId,
        });
      if (!teams.has(alias.teamId)) {
        teams.set(alias.teamId, {
          id: alias.teamId,
          name: ext.externalName,
        });
        diff.newTeams.push(alias);
      }
      teamIdOf.set(ext.externalId, alias.teamId);
      continue;
    }
    const entry = {
      externalId: ext.externalId,
      externalName: ext.externalName,
      teamId: freeSlug(ext.externalName),
    };
    teams.set(entry.teamId, {
      id: entry.teamId,
      name: ext.externalName,
    });
    aliasEntries.push(entry);
    aliasByExternalId.set(entry.externalId, entry);
    diff.newTeams.push(entry);
    teamIdOf.set(ext.externalId, entry.teamId);
  }

  const resolve = (externalId: string): TeamId => {
    const id = teamIdOf.get(externalId);
    if (id === undefined)
      throw new Error(`imported match references unknown team ${externalId}`);
    return id;
  };

  const idOf = (m: CalendarMatch): MatchId =>
    matchId({
      competitionId: competition.id,
      season,
      round: m.round,
      homeTeamId: m.home,
      awayTeamId: m.away,
    });

  const matches = new Map<MatchId, CalendarMatch>(
    (current?.matches ?? []).map((m) => [idOf(m), { ...m }]),
  );
  // Rule (g): provider match id -> derived id, for every imported match whose
  // teams resolve; entries absent from the import are kept (SPEC-005 CA-3).
  const matchAliases: Record<string, MatchId> = {
    ...(input.aliases.matches ?? {}),
  };
  const seen = new Set<MatchId>();
  for (const im of imported.matches) {
    const next: CalendarMatch = {
      round: im.round,
      kickoff: im.kickoff,
      home: resolve(im.home),
      away: resolve(im.away),
    };
    const id = idOf(next);
    seen.add(id);
    const previous = matchAliases[im.externalId];
    if (previous !== undefined && previous !== id)
      diff.rematched.push({
        externalId: im.externalId,
        from: previous,
        to: id,
      });
    matchAliases[im.externalId] = id;
    if (!im.timeConfirmed) diff.unconfirmed.push(id);
    const existing = matches.get(id);
    if (!existing) {
      matches.set(id, next);
      diff.added.push(id);
    } else if (existing.kickoff !== next.kickoff) {
      diff.rescheduled.push({ id, from: existing.kickoff, to: next.kickoff });
      existing.kickoff = next.kickoff;
    }
  }
  for (const id of matches.keys()) if (!seen.has(id)) diff.missing.push(id);
  diff.newTeams.sort((a, b) => a.teamId.localeCompare(b.teamId));

  return {
    calendar: {
      competition,
      teams: [...teams.values()].sort(byId),
      matches: [...matches.values()].sort(byRoundKickoffHome),
    },
    aliases: {
      ...input.aliases,
      source: SourceId.parse(sourceId),
      teams: aliasEntries,
      // Numeric order: JS objects already list integer-like keys ascending,
      // so this is the order JSON.stringify writes.
      matches: Object.fromEntries(
        Object.entries(matchAliases).sort(([a], [b]) =>
          a.localeCompare(b, "en", { numeric: true }),
        ),
      ),
    },
    diff,
  };
}

// Human-readable diff for calendario:sync (CA-7); new teams are marked REVISAR.
export function formatSyncDiff(competitionId: string, diff: SyncDiff): string {
  const lines = [
    `== ${competitionId}`,
    `   newTeams: ${diff.newTeams.length}  added: ${diff.added.length}  rescheduled: ${diff.rescheduled.length}  missing: ${diff.missing.length}  renamedAtProvider: ${diff.renamedAtProvider.length}  rematched: ${diff.rematched.length}  unconfirmed: ${diff.unconfirmed.length}`,
  ];
  for (const t of diff.newTeams)
    lines.push(
      `   REVISAR nuevo equipo: ${t.teamId} <- "${t.externalName}" (externalId ${t.externalId})`,
    );
  for (const id of diff.added) lines.push(`   + ${id}`);
  for (const r of diff.rescheduled)
    lines.push(`   ~ ${r.id}: ${r.from} -> ${r.to}`);
  for (const id of diff.missing)
    lines.push(`   ? ausente en el proveedor: ${id}`);
  for (const r of diff.renamedAtProvider)
    lines.push(
      `   ! el proveedor renombró ${r.teamId}: "${r.from}" -> "${r.to}" (externalId ${r.externalId})`,
    );
  for (const r of diff.rematched)
    lines.push(
      `   ! el id de partido ${r.externalId} del proveedor pasa de ${r.from} a ${r.to}`,
    );
  for (const id of diff.unconfirmed) lines.push(`   TBD/PST: ${id}`);
  for (const [round, n] of Object.entries(diff.ignoredRounds))
    lines.push(`   ronda ignorada: ${round} (${n})`);
  return lines.join("\n");
}

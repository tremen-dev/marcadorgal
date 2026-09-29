import {
  type Competition,
  DAY_MS,
  type ImportedCalendar,
  type Instant,
  instantDiff,
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
  // Kickoff of every added (the new one) and missing (the declared one) match,
  // so the diff can tell what is urgent without the calendar (SPEC-015 CA-3).
  kickoffs: Record<string, Instant>;
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

// Plain code point order, not localeCompare: the default locale of whatever
// machine happens to run the sync must not decide what the repo looks like.
// calendario:sync runs on a GitHub runner and the review happens on a laptop,
// and localeCompare without an explicit locale is free to differ between them.
const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const byId = <T extends { id: string }>(a: T, b: T) => byText(a.id, b.id);
const byExternalId = <T extends { externalId: string }>(a: T, b: T) =>
  byText(a.externalId, b.externalId);

// Matches are ordered by what identifies them and never by kickoff (O-6).
// A postponement is precisely the event CA-8 exists to put in front of a
// human (D-3), and ordering by kickoff turns that one line change into a
// block that moves across the file, burying it in hundreds of lines of
// reordering. round + home + away is the derived id of the match
// (match-id.ts), so the order is total and it never churns: a reschedule
// rewrites one kickoff in place.
const byRoundHomeAway = (a: CalendarMatch, b: CalendarMatch) =>
  a.round - b.round || byText(a.home, b.home) || byText(a.away, b.away);

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
    kickoffs: {},
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
      diff.kickoffs[id] = next.kickoff;
    } else if (existing.kickoff !== next.kickoff) {
      diff.rescheduled.push({ id, from: existing.kickoff, to: next.kickoff });
      existing.kickoff = next.kickoff;
    }
  }
  for (const [id, m] of matches)
    if (!seen.has(id)) {
      diff.missing.push(id);
      diff.kickoffs[id] = m.kickoff;
    }
  diff.newTeams.sort((a, b) => a.teamId.localeCompare(b.teamId));

  return {
    calendar: {
      competition,
      teams: [...teams.values()].sort(byId),
      matches: [...matches.values()].sort(byRoundHomeAway),
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

// URGENTE: a kickoff (old or new) in [now, now + 7 d], so the change reaches
// the next jornada. PASADO: every kickoff before now, so the match was already
// played at another time (SPEC-015 CA-3).
const URGENT_MS = 7 * DAY_MS;
type Mark = "URGENTE" | "PASADO" | null;

function markOf(now: Instant, kickoffs: (Instant | undefined)[]): Mark {
  const offsets = kickoffs
    .filter((k): k is Instant => k !== undefined)
    .map((k) => instantDiff(now, k));
  if (offsets.length === 0) return null;
  if (offsets.some((ms) => ms >= 0 && ms <= URGENT_MS)) return "URGENTE";
  if (offsets.every((ms) => ms < 0)) return "PASADO";
  return null;
}

// Human-readable diff for calendario:sync (CA-7); new teams are marked REVISAR.
// The clock is the caller's: `now` comes from tools/calendario-sync.mjs.
export function formatSyncDiff(
  competitionId: string,
  diff: SyncDiff,
  now: Instant,
): string {
  const body: string[] = [];
  const marked = (line: string, kickoffs: (Instant | undefined)[]) => {
    const mark = markOf(now, kickoffs);
    return mark ? `${line}  ${mark}` : line;
  };
  for (const t of diff.newTeams)
    body.push(
      `   REVISAR nuevo equipo: ${t.teamId} <- "${t.externalName}" (externalId ${t.externalId})`,
    );
  for (const id of diff.added)
    body.push(marked(`   + ${id}`, [diff.kickoffs[id]]));
  for (const r of diff.rescheduled)
    body.push(marked(`   ~ ${r.id}: ${r.from} -> ${r.to}`, [r.from, r.to]));
  for (const id of diff.missing)
    body.push(
      marked(`   ? ausente en el proveedor: ${id}`, [diff.kickoffs[id]]),
    );
  for (const r of diff.renamedAtProvider)
    body.push(
      `   ! el proveedor renombró ${r.teamId}: "${r.from}" -> "${r.to}" (externalId ${r.externalId})`,
    );
  for (const r of diff.rematched)
    body.push(
      `   ! el id de partido ${r.externalId} del proveedor pasa de ${r.from} a ${r.to}`,
    );
  for (const id of diff.unconfirmed) body.push(`   TBD/PST: ${id}`);
  for (const [round, n] of Object.entries(diff.ignoredRounds))
    body.push(`   ronda ignorada: ${round} (${n})`);
  return [
    `== ${competitionId}`,
    `   newTeams: ${diff.newTeams.length}  added: ${diff.added.length}  rescheduled: ${diff.rescheduled.length}  missing: ${diff.missing.length}  renamedAtProvider: ${diff.renamedAtProvider.length}  rematched: ${diff.rematched.length}  unconfirmed: ${diff.unconfirmed.length}  urgentes: ${countUrgent(diff, now)}`,
    ...body,
  ].join("\n");
}

// Number of URGENTE lines of a diff, for the title of the PR (SPEC-015 CA-3).
export function countUrgent(diff: SyncDiff, now: Instant): number {
  return [
    ...diff.added.map((id) => [diff.kickoffs[id]]),
    ...diff.rescheduled.map((r) => [r.from, r.to]),
    ...diff.missing.map((id) => [diff.kickoffs[id]]),
  ].filter((ks) => markOf(now, ks) === "URGENTE").length;
}

// A sync the workflow may merge on its own (SPEC-015 CA-4, H-1 b): every
// competition carries only reschedules of matches that already exist, and at
// least one. unconfirmed and ignoredRounds do not change the files. Whether
// data/alias/** changed is the workflow's to check, on the working tree.
export function autoAplicable(diffs: readonly SyncDiff[]): boolean {
  const clean = diffs.every(
    (d) =>
      d.newTeams.length === 0 &&
      d.added.length === 0 &&
      d.missing.length === 0 &&
      d.renamedAtProvider.length === 0 &&
      d.rematched.length === 0,
  );
  return clean && diffs.some((d) => d.rescheduled.length > 0);
}

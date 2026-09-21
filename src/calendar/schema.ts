import { z } from "zod";
import {
  AliasFile,
  Competition,
  Instant,
  Match,
  Team,
  TeamId,
} from "../model/index.ts";
import { matchId } from "./match-id.ts";

// Alias schemas moved to src/model/alias.ts (SPEC-005 CA-3); reexported here
// for SPEC-004 callers.
export { AliasEntry, AliasFile } from "../model/index.ts";

export type Issue = { path: string; message: string };

// data/calendario/<season>/<competition_id>.json: no match ids, nothing from
// the provider (N-1). Match ids are derived (CA-2).
export const CalendarMatch = z.strictObject({
  round: z.int().min(1),
  kickoff: Instant,
  home: TeamId,
  away: TeamId,
});
export type CalendarMatch = z.infer<typeof CalendarMatch>;

export const CalendarFile = z.strictObject({
  competition: Competition,
  teams: z.array(Team).min(2),
  matches: z.array(CalendarMatch).min(1),
});
export type CalendarFile = z.infer<typeof CalendarFile>;

// One issue per unknown key, so the path points at the offending key.
const zodIssues = (error: z.ZodError): Issue[] =>
  error.issues.flatMap((i) => {
    const path = i.path.join(".");
    if (i.code === "unrecognized_keys")
      return i.keys.map((k) => ({
        path: path ? `${path}.${k}` : k,
        message: `unknown key ${k}`,
      }));
    return [{ path, message: i.message }];
  });

export type CalendarContext = { season: string; competitionId: string };

export function validateCalendar(file: unknown, ctx: CalendarContext): Issue[] {
  const parsed = CalendarFile.safeParse(file);
  if (!parsed.success) return zodIssues(parsed.error);
  const { competition, teams, matches } = parsed.data;
  const issues: Issue[] = [];
  const issue = (path: string, message: string) =>
    issues.push({ path, message });

  if (competition.season !== ctx.season)
    issue("competition.season", `expected ${ctx.season}`);
  if (competition.id !== ctx.competitionId)
    issue("competition.id", `expected ${ctx.competitionId}`);

  const teamIds = new Set<string>();
  teams.forEach((team, i) => {
    if (teamIds.has(team.id)) issue(`teams.${i}.id`, `duplicate ${team.id}`);
    teamIds.add(team.id);
  });

  const seenInRound = new Set<string>();
  const seenIds = new Set<string>();
  matches.forEach((m, i) => {
    for (const side of ["home", "away"] as const) {
      if (!teamIds.has(m[side]))
        issue(`matches.${i}.${side}`, `unknown team ${m[side]}`);
    }
    if (m.home === m.away)
      issue(`matches.${i}.away`, "home and away must differ");
    for (const side of ["home", "away"] as const) {
      const key = `${m.round}:${m[side]}`;
      if (seenInRound.has(key))
        issue(
          `matches.${i}.${side}`,
          `${m[side]} plays twice in round ${m.round}`,
        );
      seenInRound.add(key);
    }
    const derived = {
      id: matchId({
        competitionId: competition.id,
        season: competition.season,
        round: m.round,
        homeTeamId: m.home,
        awayTeamId: m.away,
      }),
      competitionId: competition.id,
      season: competition.season,
      round: m.round,
      kickoff: m.kickoff,
      homeTeamId: m.home,
      awayTeamId: m.away,
    };
    if (seenIds.has(derived.id))
      issue(`matches.${i}`, `duplicate match ${derived.id}`);
    seenIds.add(derived.id);
    const match = Match.safeParse(derived);
    if (!match.success) {
      for (const zi of match.error.issues) {
        const field = String(zi.path[0] ?? "");
        const mapped =
          { homeTeamId: "home", awayTeamId: "away" }[field] ?? field;
        issue(`matches.${i}.${mapped}`, zi.message);
      }
    }
  });
  return issues;
}

export type AliasContext = {
  season: string;
  sourceId: string;
  knownTeams: Iterable<string>;
  // Ids derived from the season's calendars: every match alias must point at
  // one of them, and at most once (SPEC-005 CA-3).
  knownMatches: Iterable<string>;
};

export function validateAliases(file: unknown, ctx: AliasContext): Issue[] {
  const parsed = AliasFile.safeParse(file);
  if (!parsed.success) return zodIssues(parsed.error);
  const { source, season, teams, matches } = parsed.data;
  const issues: Issue[] = [];
  const issue = (path: string, message: string) =>
    issues.push({ path, message });
  const known = new Set(ctx.knownTeams);
  const knownMatches = new Set(ctx.knownMatches);

  if (source !== ctx.sourceId) issue("source", `expected ${ctx.sourceId}`);
  if (season !== ctx.season) issue("season", `expected ${ctx.season}`);

  const ids = new Set<string>();
  const names = new Set<string>();
  teams.forEach((t, i) => {
    if (ids.has(t.externalId))
      issue(`teams.${i}.externalId`, `duplicate ${t.externalId}`);
    ids.add(t.externalId);
    if (names.has(t.externalName))
      issue(`teams.${i}.externalName`, `duplicate ${t.externalName}`);
    names.add(t.externalName);
    if (!known.has(t.teamId))
      issue(`teams.${i}.teamId`, `unknown team ${t.teamId}`);
  });

  const seenMatches = new Set<string>();
  for (const [externalId, id] of Object.entries(matches ?? {})) {
    if (!knownMatches.has(id))
      issue(`matches.${externalId}`, `unknown match ${id}`);
    if (seenMatches.has(id))
      issue(`matches.${externalId}`, `duplicate match ${id}`);
    seenMatches.add(id);
  }
  return issues;
}

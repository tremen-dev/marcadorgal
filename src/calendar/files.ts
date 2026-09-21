import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { matchId } from "./match-id.ts";
import {
  type AliasFile,
  type CalendarFile,
  type Issue,
  validateAliases,
  validateCalendar,
} from "./schema.ts";

export type FileIssue = Issue & { file: string };

export type SeasonFiles = {
  season: string;
  calendars: CalendarFile[];
  aliases: AliasFile[];
  issues: FileIssue[];
};

const SEASON = /^\d{4}-\d{2}$/;

const jsonFiles = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .sort()
    : [];

const readJson = (file: string): unknown => {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    return { __parseError: (e as Error).message };
  }
};

// Reads data/calendario/<season>/*.json and data/alias/<season>/*.json under
// dataRoot (every season, or only the given one) and validates them (CA-1,
// CA-3 with knownTeams and knownMatches = union of the season's calendars).
// Never throws on bad data: every problem is an issue with its file.
export function readSeasons(dataRoot: string, season?: string): SeasonFiles[] {
  const calendarRoot = path.join(dataRoot, "calendario");
  const seasons = season
    ? [season]
    : existsSync(calendarRoot)
      ? readdirSync(calendarRoot)
          .filter((s) => SEASON.test(s))
          .sort()
      : [];
  return seasons.map((s) => readSeason(dataRoot, s));
}

function readSeason(dataRoot: string, season: string): SeasonFiles {
  const calendarDir = path.join(dataRoot, "calendario", season);
  const aliasDir = path.join(dataRoot, "alias", season);
  const result: SeasonFiles = {
    season,
    calendars: [],
    aliases: [],
    issues: [],
  };
  if (!existsSync(calendarDir)) {
    result.issues.push({
      file: calendarDir,
      path: "",
      message: "season directory not found",
    });
    return result;
  }
  for (const name of jsonFiles(calendarDir)) {
    const file = path.join(calendarDir, name);
    const data = readJson(file);
    const issues = validateCalendar(data, {
      season,
      competitionId: name.slice(0, -5),
    });
    if (issues.length)
      result.issues.push(...issues.map((i) => ({ ...i, file })));
    else result.calendars.push(data as CalendarFile);
  }
  const knownTeams = result.calendars.flatMap((c) => c.teams.map((t) => t.id));
  const knownMatches = result.calendars.flatMap((c) =>
    c.matches.map((m) =>
      matchId({
        competitionId: c.competition.id,
        season,
        round: m.round,
        homeTeamId: m.home,
        awayTeamId: m.away,
      }),
    ),
  );
  for (const name of jsonFiles(aliasDir)) {
    const file = path.join(aliasDir, name);
    const data = readJson(file);
    const issues = validateAliases(data, {
      season,
      sourceId: name.slice(0, -5),
      knownTeams,
      knownMatches,
    });
    if (issues.length)
      result.issues.push(...issues.map((i) => ({ ...i, file })));
    else result.aliases.push(data as AliasFile);
  }
  return result;
}

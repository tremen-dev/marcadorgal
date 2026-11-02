import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { matchId } from "../calendar/match-id.ts";
import { CalendarFile } from "../calendar/schema.ts";
import type { Match } from "../model/index.ts";

// The declared calendar of a season, as the rfef adapter needs it to resolve
// (competition, home, away) and to measure the live window against the
// declared kickoff (ADR-017 §2, ADR-023 §5). Like the alias (ADR-008 §8,
// loadAliasFile): a traced file, never a table, memoized per season so a tick
// every 30 s does not read five files every 30 s.
export type DeclaredCalendarMatch = Pick<
  Match,
  "id" | "competitionId" | "round" | "kickoff" | "homeTeamId" | "awayTeamId"
>;

const cache = new Map<string, DeclaredCalendarMatch[]>();

export function loadDeclaredCalendar(
  season: string,
  dataRoot: string = path.join(process.cwd(), "data"),
): DeclaredCalendarMatch[] {
  const key = `${dataRoot}|${season}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const dir = path.join(dataRoot, "calendario", season);
  let files: string[];
  try {
    files = readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .sort();
  } catch {
    // The path is not in the message: the error travels to ingest_attempts.
    throw new Error(`no calendar for ${season}`);
  }
  if (files.length === 0) throw new Error(`no calendar for ${season}`);

  const matches: DeclaredCalendarMatch[] = [];
  for (const file of files) {
    const parsed = CalendarFile.safeParse(
      JSON.parse(readFileSync(path.join(dir, file), "utf8")),
    );
    if (!parsed.success) throw new Error(`invalid calendar ${season}/${file}`);
    const { competition } = parsed.data;
    for (const m of parsed.data.matches)
      matches.push({
        id: matchId({
          competitionId: competition.id,
          season: competition.season,
          round: m.round,
          homeTeamId: m.home,
          awayTeamId: m.away,
        }),
        competitionId: competition.id,
        round: m.round,
        kickoff: m.kickoff,
        homeTeamId: m.home,
        awayTeamId: m.away,
      });
  }
  cache.set(key, matches);
  return matches;
}

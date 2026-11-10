import { candidateOf, isSameMatch } from "../lib/explorer-identity.ts";
import {
  madridKickoff,
  pickRowInWindow,
  type RowsByDay,
  windowDays,
} from "../lib/explorer-window.ts";
import type { AliasFile, Instant, MatchId } from "../model/index.ts";
import { matchId } from "./match-id.ts";
import type { CalendarFile, CalendarMatch } from "./schema.ts";

// The real kickoff of the declared matches already played (SPEC-071 CA-5,
// ADR-031 §1): <day of the row> <horaTexto> in Europe/Madrid, from the only
// FINISHED row of the export that pairs the match in the window (±3 days,
// identity of SPEC-070). Pure: the clock and the export come in. Neither a
// POSTPONED nor a SUSPENDED row nor an ambiguity corrects anything.

export type RealKickoffsInput = {
  calendar: CalendarFile;
  // The rfef alias of the season (codGrupo -> competition, name -> team).
  aliases: AliasFile | null;
  now: Instant;
  // Only kickoffs in [since, now) when given (CA-6).
  since?: Instant;
  rowsByDay: RowsByDay;
};

export type KickoffCorrection = { id: MatchId; from: Instant; to: Instant };

export type RealKickoffs = {
  corrections: KickoffCorrection[];
  ambiguous: {
    id: MatchId;
    candidates: (ReturnType<typeof candidateOf> & { date: string })[];
  }[];
};

const inRange = (kickoff: Instant, now: Instant, since?: Instant): boolean => {
  const t = Date.parse(kickoff);
  return t < Date.parse(now) && (since === undefined || t >= Date.parse(since));
};

const playedMatches = (
  calendar: CalendarFile,
  now: Instant,
  since?: Instant,
): CalendarMatch[] =>
  calendar.matches.filter((m) => inRange(m.kickoff, now, since));

// The days of the export the correction needs: the window of every match in
// [since, now), each once and in order.
export function realKickoffDays(
  calendar: CalendarFile,
  now: Instant,
  since?: Instant,
): string[] {
  const days = new Set(
    playedMatches(calendar, now, since).flatMap((m) => windowDays(m.kickoff)),
  );
  return [...days].sort();
}

export function realKickoffs(input: RealKickoffsInput): RealKickoffs {
  const { calendar, aliases, now, since, rowsByDay } = input;
  const { id: competitionId, season } = calendar.competition;
  const result: RealKickoffs = { corrections: [], ambiguous: [] };
  for (const m of playedMatches(calendar, now, since)) {
    const id = matchId({
      competitionId,
      season,
      round: m.round,
      homeTeamId: m.home,
      awayTeamId: m.away,
    });
    const local = { competitionId, homeTeamId: m.home, awayTeamId: m.away };
    const pairing = pickRowInWindow(
      rowsByDay,
      (row) => isSameMatch(local, row, aliases),
      m.kickoff,
    );
    if (pairing.kind === "ambiguous") {
      result.ambiguous.push({
        id,
        candidates: pairing.candidates.map((c) => ({
          date: c.date,
          ...candidateOf(c.row),
        })),
      });
      continue;
    }
    if (pairing.kind !== "paired" || pairing.row.estado !== "FINISHED")
      continue;
    const to = madridKickoff(pairing.date, pairing.row.horaTexto);
    if (to === null || Date.parse(to) === Date.parse(m.kickoff)) continue;
    result.corrections.push({ id, from: m.kickoff, to });
  }
  return result;
}

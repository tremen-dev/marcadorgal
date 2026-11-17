import { nowInstant } from "../clock.ts";
import { getGalicianClub } from "../model/clubs.ts";
import {
  type CompetitionCode,
  type CompetitionMetadata,
  getCompetitionMetadata,
} from "../model/competitions.ts";
import { Instant } from "../model/instant.ts";
import { PublicMatch } from "../model/public.ts";
import type { MatchState } from "../model/state.ts";
import { explorerRowState } from "../sources/rfef/explorer.ts";
import { LIVE_BEFORE_MINUTES, madridToUtc } from "../sources/rfef/state.ts";
import { withDeadline } from "./deadline.ts";
import {
  type DayMatchesResponse,
  getDayMatches,
  getOfficialCalendar,
  type OfficialCalendarResponse,
} from "./explorer-client.ts";
import {
  EXPLORER_ENRICHMENT_TIMEOUT_MS,
  sanitizeGoals,
  toMadridDate,
} from "./explorer-enrichment.ts";
import {
  candidateOf,
  type ExplorerRow,
  isSameMatch,
  pickRow,
} from "./explorer-identity.ts";
import {
  type KickoffPrecision,
  kickoffPrecision,
} from "./kickoff-precision.ts";

// SPEC-088 CA-1: only competitions whose calendar in explorer is the
// official one. SPEC-091 CA-2: 2ª Fed. Fem. G1 is official since
// 2026-11-17; 1ª Fed. Fem. is still a generated round-robin.
export const WOMEN_COMPETITIONS: readonly CompetitionCode[] = [
  "liga-f",
  "segunda-federacion-fem-g1",
];

const WOMEN_TEAM_NAMES: Readonly<
  Record<string, { name: string; shortName: string }>
> = {
  // Liga F
  "rc-deportivo": { name: "Deportivo ABANCA", shortName: "Depor ABANCA" },
  "depor-abanca": { name: "Deportivo ABANCA", shortName: "Depor ABANCA" },
  "fc-barcelona": { name: "FC Barcelona", shortName: "Barcelona" },
  "barcelona-femenino": { name: "FC Barcelona", shortName: "Barcelona" },
  "real-madrid-femenino": { name: "Real Madrid", shortName: "Real Madrid" },
  "atletico-madrid": { name: "Atlético de Madrid", shortName: "Atlético" },
  "atletico-madrid-femenino": {
    name: "Atlético de Madrid",
    shortName: "Atlético",
  },
  "athletic-femenino": { name: "Athletic Club", shortName: "Athletic" },
  "sevilla-fc": { name: "Sevilla FC", shortName: "Sevilla" },
  "valencia-cf": { name: "Valencia CF", shortName: "Valencia" },
  "espanyol-femenino": { name: "RCD Espanyol", shortName: "Espanyol" },
  "real-sociedad-femenino": {
    name: "Real Sociedad",
    shortName: "Real Sociedad",
  },
  "eibar-femenino": { name: "SD Eibar", shortName: "Eibar" },
  "granada-femenino": { name: "Granada CF", shortName: "Granada" },
  "logrono-united": { name: "Logroño United", shortName: "Logroño" },
  "madrid-cff": { name: "Madrid CFF", shortName: "Madrid CFF" },
  "badalona-women": { name: "Levante Badalona", shortName: "Badalona" },
  "levante-badalona": { name: "Levante Badalona", shortName: "Badalona" },
  "costa-adeje-tenerife": {
    name: "Costa Adeje Tenerife",
    shortName: "Tenerife",
  },
  alaves: { name: "Deportivo Alavés", shortName: "Alavés" },

  // 1ª Federación Femenina
  "alaves-gloriosas": {
    name: "Deportivo Alavés Gloriosas",
    shortName: "Alavés",
  },
  "albacete-femenino": { name: "CD Alba Fundación", shortName: "Albacete" },
  "alhama-cf": { name: "Alhama CF ElPozo", shortName: "Alhama" },
  "athletic-b": { name: "Athletic Club B", shortName: "Athletic B" },
  "atletico-madrid-b": {
    name: "Atlético de Madrid B",
    shortName: "Atlético B",
  },
  "barcelona-b": { name: "FC Barcelona B", shortName: "Barcelona B" },
  "cacereno-femenino": { name: "CP Cacereño", shortName: "Cacereño" },
  "getafe-femenino": { name: "Getafe CF Femenino", shortName: "Getafe" },
  "madrid-cff-b": { name: "Madrid CFF B", shortName: "Madrid CFF B" },
  "osasuna-femenino": { name: "CA Osasuna", shortName: "Osasuna" },
  "real-madrid-b": { name: "Real Madrid B", shortName: "Real Madrid B" },
  "se-aem": { name: "SE AEM Lleida", shortName: "AEM" },
  "sporting-gijon-femenino": {
    name: "Real Sporting de Gijón",
    shortName: "Sporting",
  },
  "villarreal-femenino": { name: "Villarreal CF", shortName: "Villarreal" },

  // 2ª Federación Femenina - G1 (Galegas e rivais)
  "as-celtas": {
    name: "RC Celta Femenino (As Celtas)",
    shortName: "As Celtas",
  },
  "depor-abanca-b": { name: "Deportivo ABANCA B", shortName: "Depor ABANCA B" },
  "lugo-femenino": { name: "CD Lugo Femenino", shortName: "Lugo Fem." },
  "pm-friol": { name: "Peluquería Mixta Friol", shortName: "PM Friol" },
  "sardoma-cf": { name: "Sárdoma CF", shortName: "Sárdoma" },
  "viajes-interrias-ff": {
    name: "Viajes InterRías FF",
    shortName: "InterRías",
  },
  "victoria-cf": { name: "Victoria CF", shortName: "Victoria CF" },
  "aviles-stadium-femenino": {
    name: "Avilés Stadium CF",
    shortName: "Avilés",
  },
  "bizkerre-club": { name: "Bizkerre Club", shortName: "Bizkerre" },
  "burgos-cf-femenino": { name: "Burgos CF", shortName: "Burgos" },
  "cd-arratia": { name: "CD Arratia", shortName: "Arratia" },
  "eibar-b": { name: "SD Eibar B", shortName: "Eibar B" },
  "osasuna-b": { name: "CA Osasuna B", shortName: "Osasuna B" },
  "racing-santander-femenino": {
    name: "Racing de Santander",
    shortName: "Racing",
  },
  "real-oviedo-femenino": {
    name: "Real Oviedo Femenino",
    shortName: "Oviedo",
  },
  "sporting-gijon-b": { name: "Real Sporting B", shortName: "Sporting B" },

  // SPEC-091 CA-8: the ids of the official G1 calendar of explorer that the
  // entries above do not cover (F-SPEC-091-1 cleans the old ones).
  arratia: { name: "CD Arratia", shortName: "Arratia" },
  "burgos-femenino": { name: "Burgos CF", shortName: "Burgos" },
  "eibar-femenino-b": { name: "SD Eibar B", shortName: "Eibar B" },
  "osasuna-femenino-b": { name: "CA Osasuna B", shortName: "Osasuna B" },
  "rayo-vallecano-femenino": {
    name: "Rayo Vallecano",
    shortName: "Rayo",
  },
  "real-aviles-industrial": {
    name: "Real Avilés Industrial",
    shortName: "Avilés",
  },
};

// The visible name of an explorer team id (SPEC-091 CA-8): the Galician
// club, then the table, then the name explorer gives; never the id when
// either knows it.
export function resolveTeamNames(
  teamId: string,
  fallbackName?: string,
): { name: string; shortName: string } {
  const galician = getGalicianClub(teamId);
  if (galician) {
    return { name: galician.name, shortName: galician.shortName };
  }
  const known = WOMEN_TEAM_NAMES[teamId];
  if (known) {
    return known;
  }
  const name = fallbackName || teamId;
  return { name, shortName: name };
}

export function findActiveRound(
  calendar: OfficialCalendarResponse,
  nowIso: string,
): number {
  const nowMs = new Date(nowIso).getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const byRound = new Map<number, Array<{ kickoff: string }>>();

  for (const m of calendar.matches) {
    const list = byRound.get(m.round) ?? [];
    list.push(m);
    byRound.set(m.round, list);
  }

  const rounds = [...byRound.keys()].sort((a, b) => a - b);
  // Find first round having at least one match playing now or in the near future
  for (const round of rounds) {
    const matches = byRound.get(round) ?? [];
    const hasUpcoming = matches.some(
      (m) => new Date(m.kickoff).getTime() >= nowMs - oneDayMs,
    );
    if (hasUpcoming) {
      return round;
    }
  }

  // Fallback to highest round or 1
  return rounds[rounds.length - 1] ?? 1;
}

// The two Explorer reads of the women xornada (SPEC-085 CA-2): injected by
// the board read, the client by default.
export type WomenExplorer = {
  calendar(
    competition: string,
    season: string,
  ): Promise<OfficialCalendarResponse>;
  dayMatches(date: string): Promise<DayMatchesResponse>;
};

// Every request with its deadline (SPEC-085 CA-3, M-15): it aborts the socket.
export const clientExplorer = (timeoutMs: number): WomenExplorer => ({
  calendar: (competition, season) =>
    getOfficialCalendar(competition, season, undefined, { timeoutMs }),
  dayMatches: (date) => getDayMatches(date, undefined, { timeoutMs }),
});

// SPEC-085 CA-3: the whole read (calendars, then days) has one deadline,
// EXPLORER_ENRICHMENT_TIMEOUT_MS by default; past it, no women ([]).
export async function fetchWomenXornadaMatches(
  nowIso: string = nowInstant(),
  season: string = "2026-27",
  explorer?: WomenExplorer,
  options: { timeoutMs?: number } = {},
): Promise<PublicMatch[]> {
  const timeoutMs = options.timeoutMs ?? EXPLORER_ENRICHMENT_TIMEOUT_MS;
  try {
    return await withDeadline(
      womenMatches(nowIso, season, explorer ?? clientExplorer(timeoutMs)),
      timeoutMs,
      "explorer-xornada",
    );
  } catch (e) {
    console.error("fetchWomenXornadaMatches failed:", e);
    return [];
  }
}

async function womenMatches(
  nowIso: string,
  season: string,
  explorer: WomenExplorer,
): Promise<PublicMatch[]> {
  const calendarResults = await Promise.allSettled(
    WOMEN_COMPETITIONS.map(async (comp) => {
      const cal = await explorer.calendar(comp, season);
      return { comp, cal };
    }),
  );

  const compDataList: Array<{
    comp: CompetitionCode;
    meta: CompetitionMetadata | undefined;
    roundMatches: OfficialCalendarResponse["matches"];
    teamsMap: Map<string, string>;
  }> = [];

  const allDates = new Set<string>([nowIso.slice(0, 10)]);

  for (const res of calendarResults) {
    if (
      res.status !== "fulfilled" ||
      !res.value.cal?.matches ||
      res.value.cal.matches.length === 0
    ) {
      continue;
    }
    const { comp, cal } = res.value;
    const round = findActiveRound(cal, nowIso);
    const roundMatches = cal.matches.filter((m) => m.round === round);
    if (roundMatches.length === 0) continue;

    for (const m of roundMatches) {
      for (const d of rowDays(m, nowIso)) allDates.add(d);
    }

    const meta = getCompetitionMetadata(comp);
    const teamsMap = new Map(
      (cal.teams || []).map((t) => [t.externalId, t.externalName]),
    );

    compDataList.push({
      comp,
      meta,
      roundMatches,
      teamsMap,
    });
  }

  if (compDataList.length === 0) {
    return [];
  }

  // Every row of each day, never keyed by teams alone: a Map by
  // home-away kept the last row of any competition (SPEC-070 CA-6). A day
  // that cannot be read stays out of the map (SPEC-086 CA-1): its matches do
  // not come out, never as scheduled.
  const rowsByDate = new Map<string, ExplorerRow[]>();
  await Promise.all(
    [...allDates].map(async (d) => {
      try {
        const res = await explorer.dayMatches(d);
        if (!Array.isArray(res?.matches)) throw new Error("no matches");
        rowsByDate.set(d, res.matches);
      } catch (e) {
        console.error(
          `[explorer-xornada] o día ${d} non se puido ler, os seus partidos non saen:`,
          e,
        );
      }
    }),
  );

  const results: PublicMatch[] = [];

  for (const { comp, meta, roundMatches, teamsMap } of compDataList) {
    const competitionName = meta?.name || meta?.officialName || comp;
    const tier = (meta?.tier ?? 1) as 1 | 2 | 3 | 4 | 5;

    for (const m of roundMatches) {
      const precision = kickoffPrecision(m);
      // SPEC-086 CA-1: a day that cannot be read leaves its matches out; a
      // round match needs both of its days (SPEC-091 CA-5).
      const days = rowDays(m, nowIso);
      if (days.some((d) => !rowsByDate.has(d))) continue;
      const rowDay = new Map<ExplorerRow, string>();
      for (const d of days)
        for (const r of rowsByDate.get(d) ?? []) rowDay.set(r, d);
      const rows = [...rowDay.keys()];

      // Identity of SPEC-070 without alias: the competition of the row is
      // its canonicalCompetitionId and each side a canonical id equal to
      // the calendar's (or the calendar's without -femenino).
      const homeIds = [m.home, m.home.replace(/-femenino$/, "")];
      const pairing = pickRow(
        rows,
        (row) =>
          homeIds.some((homeTeamId) =>
            isSameMatch(
              { competitionId: comp, homeTeamId, awayTeamId: m.away },
              row,
              null,
            ),
          ),
        m.kickoff,
      );
      if (pairing.kind === "ambiguous") {
        // SPEC-086 CA-1 (refines SPEC-070 CA-6): the match does not come out.
        console.warn(
          `[explorer-xornada] ${m.externalId}: varias filas do export cumpren a identidade, o partido non sae:`,
          pairing.candidates
            .map((r) => {
              const c = candidateOf(r);
              return `${c.codActa ?? "sen acta"} ${c.home ?? "?"}–${c.away ?? "?"}`;
            })
            .join("; "),
        );
        continue;
      }
      const dayMatch = pairing.kind === "paired" ? pairing.row : null;
      // A match without a confirmed hour (date or round) has no real
      // kickoff: its live window runs from the hour of the row, on the day of
      // the row (SPEC-091 CA-5/CA-6, V-1); with no reliable hour, the row's
      // Madrid day (V-3). Never the nominal 00:00Z.
      const stateKickoff =
        precision !== "exact" && dayMatch !== null
          ? (liveKickoff(rowDay.get(dayMatch), dayMatch) ?? m.kickoff)
          : m.kickoff;
      const view = viewOf(dayMatch, precision, m.kickoff, stateKickoff, nowIso);
      if (view === null) continue;

      const homeNames = resolveTeamNames(m.home, teamsMap.get(m.home));
      const awayNames = resolveTeamNames(m.away, teamsMap.get(m.away));
      const goals = sanitizeGoals(dayMatch?.goals ?? []);

      const candidate = {
        ...view.state,
        matchId: m.externalId,
        competitionId: comp,
        competitionName,
        tier,
        round: m.round,
        kickoff: m.kickoff,
        // SPEC-091 CA-5/CA-6: absent is exact (every male match).
        ...(precision === "exact" ? {} : { kickoffPrecision: precision }),
        home: { name: homeNames.name, shortName: homeNames.shortName },
        away: { name: awayNames.name, shortName: awayNames.shortName },
        qualifier: "confirmado" as const,
        // SPEC-086 CA-6: the clocks are the row's, never the render's.
        version: view.at === null ? 0 : 1,
        observedAt: view.at,
        decidedAt: view.at,
        homeScoredAt: null,
        awayScoredAt: null,
        ...(goals.length > 0 ? { goals } : {}),
      };

      // SPEC-086 CA-5: one match that does not validate is dropped alone.
      const parsed = PublicMatch.safeParse(candidate);
      if (!parsed.success) {
        console.warn(
          `[explorer-xornada] ${m.externalId}: non valida como PublicMatch, descartado:`,
          parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        );
        continue;
      }
      results.push(parsed.data);
    }
  }

  return results;
}

type View = {
  state: MatchState;
  at: string | null;
};

const SCHEDULED: View = {
  state: { status: "scheduled", score: null, minute: null },
  at: null,
};

// SPEC-088 CA-2/CA-3: how long a match with no played row may still say
// scheduled. A confirmed time, until kickoff plus the margin the ingest
// grants before it; an unconfirmed one (00:00Z is "that day"), the whole
// Madrid day of its kickoff. SPEC-091 CA-5: a round match, its nominal day.
function stillScheduled(
  precision: KickoffPrecision,
  kickoff: string,
  nowIso: string,
): boolean {
  // A kickoff that is not an instant is not judged here: PublicMatch rejects
  // it below, with its warn (SPEC-086 CA-5).
  if (!Instant.safeParse(kickoff).success) return true;
  if (precision === "exact") {
    return (
      Date.parse(nowIso) < Date.parse(kickoff) + LIVE_BEFORE_MINUTES * 60_000
    );
  }
  return toMadridDate(nowIso) <= toMadridDate(kickoff);
}

// The Madrid days whose export rows a calendar match is paired against: its
// day; a round match also today, since the RFEF may play the round on
// another day of the weekend (SPEC-091 CA-5, nota 5).
function rowDays(
  match: { kickoff: string; timeConfirmed: boolean; dateConfirmed?: boolean },
  nowIso: string,
): string[] {
  const nominal = toMadridDate(match.kickoff);
  if (kickoffPrecision(match) !== "round") return [nominal];
  const today = toMadridDate(nowIso);
  return today === nominal ? [nominal] : [nominal, today];
}

// The instant of the row's own day and hour in Madrid ("HH:MM"), or null.
function rowKickoff(
  date: string | undefined,
  horaTexto: string | undefined,
): string | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? "");
  const h = /^(\d{2}):(\d{2})$/.exec(horaTexto ?? "");
  if (d === null || h === null) return null;
  const ms = madridToUtc(
    Number(d[1]),
    Number(d[2]),
    Number(d[3]),
    Number(h[1]),
    Number(h[2]),
  );
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

// The kickoff that opens the live window of a match without a confirmed
// hour, off its row: the row's hour on the row's day; without a reliable
// hour, the row's Madrid day is the window (SPEC-088 CA-3 reads a 00:00Z
// kickoff as "that day"), so a row seen that day is judged from its own
// lastSeenAt and one seen on another day is not (null).
function liveKickoff(
  date: string | undefined,
  row: ExplorerRow,
): string | null {
  const byHour = rowKickoff(date, row.horaTexto);
  if (byHour !== null) return byHour;
  const seen = Instant.safeParse(row.lastSeenAt);
  if (!seen.success || date === undefined) return null;
  return toMadridDate(seen.data) === date ? seen.data : null;
}

// The state of a calendar match off its export row, with the rules of the
// ingest (explorerRowState, ADR-023 §5): null when it must not come out.
// Without a row, or with a SCHEDULED one, it is scheduled without a Decision
// while stillScheduled (SPEC-088 CA-2..CA-4); past it, it does not come out.
// `stateKickoff` is the kickoff of the live window (SPEC-091 CA-5).
function viewOf(
  row: ExplorerRow | null,
  precision: KickoffPrecision,
  kickoff: string,
  stateKickoff: string,
  nowIso: string,
): View | null {
  if (row === null || row.estado === "SCHEDULED") {
    return stillScheduled(precision, kickoff, nowIso) ? SCHEDULED : null;
  }
  // SPEC-086 CA-6: a row that has played without its clock does not come out.
  const lastSeenAt = Instant.safeParse(row.lastSeenAt);
  if (!lastSeenAt.success) return null;
  // SPEC-086 CA-2: one score per side, either naming; never a 0 of our own.
  const state = explorerRowState(
    {
      estado: row.estado,
      golesLocal: row.homeScore ?? row.golesLocal ?? null,
      golesVisitante: row.awayScore ?? row.golesVisitante ?? null,
      lastSeenAt: lastSeenAt.data,
      minute: row.minute,
      addedMinute: row.addedMinute,
      halfTime: row.halfTime,
    },
    stateKickoff,
  );
  if (typeof state === "string") return null;
  return {
    // PublicMatch says halfTime explicitly in live (SPEC-021 CA-6).
    state:
      state.status === "live"
        ? { ...state, halfTime: state.halfTime ?? false }
        : state,
    at: lastSeenAt.data,
  };
}

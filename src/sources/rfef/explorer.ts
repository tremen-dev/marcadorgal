import { z } from "zod";
import {
  type AliasFile,
  type CompetitionId,
  type FetchContext,
  Instant,
  type Match,
  type MatchState,
  type ParseResult,
  type RawCapture,
  type RequestError,
  type SkippedReason,
  type SourceAdapter,
  SourceId,
  type TeamId,
  type Unresolved,
} from "../../model/index.ts";
import { type DeclaredMatch, normalizeName } from "./adapter.ts";
import { inLiveWindow } from "./state.ts";

// The rfef via explorer (ADR-023, SPEC-038, SPEC-049): one GET per tick to the export
// of a service of our own, which reads marcadores.rfef.es with its own rules.
// This is the adapter ADAPTERS["rfef"] builds. adapter.ts (the direct way,
// SPEC-031) stays next to it, unregistered and in reserve; identity is the
// same (ADR-017 §2): normalizeName, the competitions map of the alias and the
// resolution (competition, home, away) against the declared calendar.

const RFEF = SourceId.parse("rfef");
export const EXPORT_PATH = "/api/export/matches";

// The contract of ADR-023 §4, as explorer serves it. Unknown fields are
// tolerated (looseObject); a value outside the enum is not. The two enums left
// (estado, goals[].team) are domain and stay closed on purpose (SPEC-069).
export const ExplorerStatus = z.enum([
  "SCHEDULED",
  "LIVE_PROVISIONAL",
  "FINISHED",
  "POSTPONED",
  "SUSPENDED",
]);
export type ExplorerStatus = z.infer<typeof ExplorerStatus>;

export const ExplorerGoal = z.looseObject({
  team: z.enum(["home", "away"]),
  player: z.string().min(1),
  minute: z.int().min(0),
  penalty: z.boolean().optional(),
  ownGoal: z.boolean().optional(),
});
export type ExplorerGoal = z.infer<typeof ExplorerGoal>;

export const ExplorerMatch = z.looseObject({
  codActa: z.string().nullable(),
  codGrupo: z.string(),
  codCompeticion: z.string(),
  jornada: z.string(),
  fechaIso: z.string().nullable(),
  horaTexto: z.string(),
  codEquipoLocal: z.string().nullable(),
  equipoLocal: z.string(),
  codEquipoVisitante: z.string().nullable(),
  equipoVisitante: z.string(),
  golesLocal: z.int().nullable(),
  golesVisitante: z.int().nullable(),
  estado: ExplorerStatus,
  // The instant of the last answer of the RFEF in which explorer read the
  // row: the clock of every observation (RN-11, ADR-023 §5).
  lastSeenAt: Instant,
  lastChangedAt: Instant,
  strategy: z.string(),
  discardedReadings: z.int().min(0),
  // Multi-provider enhancements (SPEC-049)
  canonicalCompetitionId: z.string().optional(),
  canonicalHomeTeamId: z.string().optional(),
  canonicalAwayTeamId: z.string().optional(),
  // The provider whose reading explorer arbitrated as the live one (SPEC-049).
  // Informative only, and an open list (SPEC-069): "marca", "rfef", "espn",
  // "football-data" are the known values, not a closed set. A new provider
  // never rejects the export; an empty string is not a provider.
  liveProvider: z.string().min(1).optional(),
  goals: z.array(ExplorerGoal).optional(),
  // Live minute and half-time (SPEC-052)
  minute: z.int().nullable().optional(),
  addedMinute: z.int().nullable().optional(),
  halfTime: z.boolean().optional(),
});
export type ExplorerMatch = z.infer<typeof ExplorerMatch>;

export const ExplorerExport = z.looseObject({
  exportedAt: Instant,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  matches: z.array(ExplorerMatch),
});
export type ExplorerExport = z.infer<typeof ExplorerExport>;

// The declared calendar with its kickoff (ADR-008 §8): adapter.ts reads the
// kickoff off the panel row; here it is the calendar's.
export type DeclaredFixture = DeclaredMatch & Pick<Match, "kickoff">;

export type RfefExplorerOptions = {
  aliases: AliasFile;
  calendar: readonly DeclaredFixture[];
  // The origin of explorer (RFEF_EXPLORER_URL) and its Bearer
  // (RFEF_EXPLORER_TOKEN). The token never leaves fetch: not in the url, not
  // in the capture (N-3).
  baseUrl: string;
  token: string;
};

// The day of an instant in Europe/Madrid, YYYY-MM-DD: the export is asked by
// local date (ADR-023 §4). The tz database of ICU, never a Date of our own.
const madrid = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Madrid",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function madridDateOf(instant: Instant): string {
  const parts = new Map(
    madrid.formatToParts(Date.parse(instant)).map((p) => [p.type, p.value]),
  );
  return `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}`;
}

const messageOf = (e: unknown): string => {
  const message = e instanceof Error ? e.message : String(e);
  return message.length > 0 ? message : "unreadable body";
};

// One line per issue, path first: the tick prints the first error inline.
const zodMessage = (error: z.ZodError): string =>
  `export: ${error.issues
    .map((i) => `${i.path.join(".") || "(body)"}: ${i.message}`)
    .join("; ")}`;

function readExport(body: string): ExplorerExport {
  if (body.length === 0) throw new Error("empty body");
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch (e) {
    throw new Error(`not JSON: ${messageOf(e)}`);
  }
  const parsed = ExplorerExport.safeParse(json);
  if (!parsed.success) throw new Error(zodMessage(parsed.error));
  return parsed.data;
}

const scoreOf = (row: ExplorerMatch) =>
  row.golesLocal === null || row.golesVisitante === null
    ? null
    : { home: row.golesLocal, away: row.golesVisitante };

// ADR-023 §5, with the declared kickoff and the row's lastSeenAt as clock.
// SCHEDULED is decided before this is called: it never gets here.
function rowState(
  row: ExplorerMatch,
  kickoff: Instant,
): MatchState | SkippedReason {
  const score = scoreOf(row);
  switch (row.estado) {
    case "POSTPONED":
      return { status: "postponed", score: null, minute: null };
    case "SUSPENDED":
      return score === null
        ? "suspended_without_score"
        : { status: "suspended", score, minute: null };
    case "FINISHED":
      return score === null
        ? "missing_score"
        : { status: "finished", score, minute: null };
    case "LIVE_PROVISIONAL":
      if (score === null) return "missing_score";
      {
        const liveMinute =
          row.minute !== undefined && row.minute !== null && row.minute >= 0
            ? Math.min(row.minute, 130)
            : null;
        const liveAdded =
          row.addedMinute !== undefined &&
          row.addedMinute !== null &&
          row.addedMinute > 0
            ? Math.min(row.addedMinute, 30)
            : null;
        const hasExplicitLive = liveMinute !== null || row.halfTime === true;
        const liveWindowMinutes = hasExplicitLive ? 140 : 130;
        return inLiveWindow(
          Date.parse(kickoff),
          Date.parse(row.lastSeenAt),
          liveWindowMinutes,
        )
          ? {
              status: "live",
              score,
              minute: liveMinute,
              addedMinute: liveAdded,
              ...(row.halfTime !== undefined ? { halfTime: row.halfTime } : {}),
            }
          : "ambiguous_state";
      }
    default:
      return "unsupported_status";
  }
}

export function createRfefExplorer({
  aliases,
  calendar,
  baseUrl,
  token,
}: RfefExplorerOptions): SourceAdapter {
  const teamByName = new Map<string, TeamId>(
    aliases.teams.map((t) => [normalizeName(t.externalId), t.teamId]),
  );
  const competitionOf = new Map<string, CompetitionId>(
    Object.entries(aliases.competitions ?? {}),
  );
  const matchOf = new Map<string, DeclaredFixture>(
    calendar.map((m) => [
      `${m.competitionId}|${m.homeTeamId}|${m.awayTeamId}`,
      m,
    ]),
  );
  const origin = baseUrl.replace(/\/+$/, "");

  // Identity as adapter.ts resolves it: name, competition and round. The
  // codes of the export (codEquipo*, codActa) stay in the raw capture.
  // Prioritizes candidate pairings (alias map and canonical IDs) that match
  // a declared fixture in matchOf (SPEC-049, SPEC-054).
  function resolveMatch(
    row: ExplorerMatch,
    competitionId: CompetitionId,
  ): DeclaredFixture | Unresolved["reason"] {
    const localCandidates = [
      teamByName.get(normalizeName(row.equipoLocal)),
      row.canonicalHomeTeamId as TeamId | undefined,
    ].filter((t): t is TeamId => Boolean(t));

    const awayCandidates = [
      teamByName.get(normalizeName(row.equipoVisitante)),
      row.canonicalAwayTeamId as TeamId | undefined,
    ].filter((t): t is TeamId => Boolean(t));

    if (localCandidates.length === 0 || awayCandidates.length === 0) {
      return "unknown_team";
    }

    let match: DeclaredFixture | undefined;
    for (const h of localCandidates) {
      for (const a of awayCandidates) {
        match = matchOf.get(`${competitionId}|${h}|${a}`);
        if (match) break;
      }
      if (match) break;
    }

    if (match === undefined) return "unknown_match";
    if (match.round !== Number(row.jornada)) return "inconsistent_alias";
    return match;
  }

  function parseRequest(body: string) {
    const out: Omit<ParseResult, "requestErrors"> = {
      observations: [],
      unresolved: [],
      skipped: [],
    };
    for (const row of readExport(body).matches) {
      const competitionId =
        competitionOf.get(row.codGrupo) ??
        (row.canonicalCompetitionId as CompetitionId | undefined);
      if (competitionId === undefined) continue; // juvenil, femenino: ignored
      // A row without a state says nothing (ADR-023 §5): not even identity.
      if (row.estado === "SCHEDULED") continue;
      const match = resolveMatch(row, competitionId);
      if (typeof match === "string") {
        out.unresolved.push({
          reason: match,
          externalCompetition: row.codGrupo,
          externalMatchId: row.codActa,
          home: {
            externalId: normalizeName(row.equipoLocal),
            externalName: row.equipoLocal,
          },
          away: {
            externalId: normalizeName(row.equipoVisitante),
            externalName: row.equipoVisitante,
          },
          status: row.estado,
        });
        continue;
      }
      // The live window is measured against the declared kickoff, never
      // against the row's own hour (ADR-023 §5).
      const state = rowState(row, match.kickoff);
      if (typeof state === "string") {
        out.skipped.push({
          externalMatchId: row.codActa,
          status: row.estado,
          reason: state,
        });
        continue;
      }
      out.observations.push({
        matchId: match.id,
        ...state,
        observedAt: row.lastSeenAt,
      });
    }
    return out;
  }

  return {
    id: RFEF,
    kind: "pull",

    async fetch(ctx: FetchContext): Promise<RawCapture> {
      const capture: RawCapture = {
        sourceId: RFEF,
        capturedAt: ctx.now,
        requests: [],
      };
      if (ctx.matches.length === 0) return capture; // RN-08

      // One GET per Europe/Madrid date among the kickoffs of the window:
      // normally one. The export brings the whole day; the core keeps only
      // what is in window (ADR-023 §5, SPEC-038 CA-6).
      const dates = [
        ...new Set(ctx.matches.map((m) => madridDateOf(m.kickoff))),
      ].sort();
      for (const date of dates) {
        const url = `${origin}${EXPORT_PATH}?date=${date}`;
        const res = await ctx.fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "User-Agent": ctx.userAgent,
          },
        });
        // A no-2xx is the failure of the attempt (ADR-003): 401 is a wrong
        // secret, 400 a wrong date, 5xx explorer down.
        if (res.status < 200 || res.status > 299)
          throw new Error(`rfef explorer responded ${res.status}`);
        // A 200 with an empty or non-JSON body does not throw: it goes to the
        // raw capture as evidence and parse reports it (CA-2 iii).
        capture.requests.push({
          url,
          method: "GET",
          status: res.status,
          contentType: res.headers.get("content-type"),
          body: await res.text(),
        });
      }
      return capture;
    },

    parse(raw: RawCapture): ParseResult {
      const result: ParseResult = {
        observations: [],
        unresolved: [],
        skipped: [],
        requestErrors: [],
      };
      for (const request of raw.requests) {
        // Per request (SPEC-011 CA-2): a body explorer could not serve as the
        // contract says is recorded, gives zero observations, and the next
        // request is still read.
        try {
          const out = parseRequest(request.body);
          result.observations.push(...out.observations);
          result.unresolved.push(...out.unresolved);
          result.skipped.push(...out.skipped);
        } catch (e) {
          const error: RequestError = { url: request.url, error: messageOf(e) };
          result.requestErrors.push(error);
        }
      }
      return result;
    },

    resolveTeam(external: string, _competition: CompetitionId): TeamId | null {
      return teamByName.get(normalizeName(external)) ?? null;
    },
  };
}

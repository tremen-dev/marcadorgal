import { z } from "zod";
import {
  AddedMinute,
  type AliasFile,
  type CompetitionId,
  type FetchContext,
  type MatchState,
  type MatchStatus,
  type ParseResult,
  type RawCapture,
  type RawRequest,
  type Skipped,
  type SourceAdapter,
  SourceId,
  type TeamId,
  type Unresolved,
} from "../../model/index.ts";
import { LEAGUES } from "./calendar.ts";

const BASE_URL = "https://v3.football.api-sports.io";
const IDS_PER_REQUEST = 20;

// API-Football league id -> competition id (inverse of LEAGUES).
const COMPETITION_OF_LEAGUE = new Map<number, string>(
  Object.entries(LEAGUES).map(([competition, league]) => [league, competition]),
);

// Provider status.short -> the five states (N-7). Anything else is skipped.
const STATUS: Readonly<Record<string, MatchStatus>> = {
  NS: "scheduled",
  TBD: "scheduled",
  "1H": "live",
  HT: "live",
  "2H": "live",
  ET: "live",
  BT: "live",
  P: "live",
  LIVE: "live",
  FT: "finished",
  AET: "finished",
  PEN: "finished",
  AWD: "finished",
  WO: "finished",
  PST: "postponed",
  CANC: "postponed",
  SUSP: "suspended",
  INT: "suspended",
  ABD: "suspended",
};

const ProviderId = z.union([z.int(), z.string().min(1)]);
const ProviderTeam = z.looseObject({ id: ProviderId, name: z.string() });
const ProviderFixture = z.looseObject({
  fixture: z.looseObject({
    id: ProviderId,
    status: z.looseObject({
      short: z.string(),
      elapsed: z.int().nullable().optional(),
      extra: z.int().nullable().optional(),
    }),
  }),
  league: z.looseObject({ id: ProviderId }),
  teams: z.looseObject({ home: ProviderTeam, away: ProviderTeam }),
  goals: z.looseObject({
    home: z.int().nullable(),
    away: z.int().nullable(),
  }),
});
type ProviderFixture = z.infer<typeof ProviderFixture>;
const ProviderBody = z.looseObject({
  errors: z.unknown().optional(),
  response: z.array(ProviderFixture),
});

const hasErrors = (errors: unknown): boolean =>
  Array.isArray(errors)
    ? errors.length > 0
    : typeof errors === "object" && errors !== null
      ? Object.keys(errors).length > 0
      : errors !== undefined && errors !== null;

const MAX_ADDED_MINUTE = AddedMinute.maxValue ?? 30;

// minute = elapsed; addedMinute = extra in 1..30, null when absent or 0 (N-8);
// an extra above 30 is clamped.
function liveMinutes(status: ProviderFixture["fixture"]["status"]) {
  const minute = status.elapsed ?? null;
  const extra = status.extra ?? 0;
  const addedMinute =
    extra > 0 ? AddedMinute.parse(Math.min(extra, MAX_ADDED_MINUTE)) : null;
  return { minute, addedMinute };
}

export type ApiFootballResultsOptions = {
  aliases: AliasFile;
  apiKey: string;
};

const ascending = (a: string, b: string) => Number(a) - Number(b);

// The live= query of a set of league ids, or null when there is no legal one
// (SPEC-011 CA-1). The provider documents two forms for the field, ids joined
// by hyphens and the string "all"; a single id is neither, and it answers 200
// with errors. So with fewer than two leagues there is no live= request at
// all: ids= covers the window, the same path N-10 already takes before any
// kickoff.
export function liveQuery(leagues: readonly number[]): string | null {
  const ids = [...new Set(leagues)].sort((a, b) => a - b);
  return ids.length < 2 ? null : `live=${ids.join("-")}`;
}

// Only the fixture ids of a live= body, to know what to ask ids= for (N-9).
// States are not interpreted here: that is parse, over the full capture.
function fixtureIdsIn(body: string): Set<string> {
  const ids = new Set<string>();
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return ids;
  }
  const response = (parsed as { response?: unknown })?.response;
  if (!Array.isArray(response)) return ids;
  for (const item of response) {
    const id = (item as { fixture?: { id?: unknown } })?.fixture?.id;
    if (typeof id === "number" || typeof id === "string") ids.add(String(id));
  }
  return ids;
}

// The five states from a provider fixture (N-7, N-8): null when the status is
// not supported, "missing_score" when a state that needs goals lacks one.
function toState(
  short: string,
  f: ProviderFixture,
): MatchState | "missing_score" | null {
  const status = STATUS[short];
  if (status === undefined) return null;
  if (status === "scheduled" || status === "postponed")
    return { status, score: null, minute: null };
  const { home, away } = f.goals;
  if (home === null || away === null) return "missing_score";
  const score = { home, away };
  if (status === "live")
    return { status, score, ...liveMinutes(f.fixture.status) };
  return { status, score, minute: null };
}

// Results adapter of API-Football (SPEC-005 CA-5/CA-6). A factory (N-6):
// parse and resolveTeam are pure over the injected alias, and the key never
// travels in FetchContext.
export function createApiFootballResults({
  aliases,
  apiKey,
}: ApiFootballResultsOptions): SourceAdapter {
  const teamByExternalId = new Map<string, TeamId>(
    aliases.teams.map((t) => [t.externalId, t.teamId]),
  );
  const fixtureIdByMatchId = new Map<string, string>(
    Object.entries(aliases.matches ?? {}).map(([ext, id]) => [id, ext]),
  );

  return {
    id: SourceId.parse("api-football"),
    kind: "pull",

    async fetch(ctx: FetchContext): Promise<RawCapture> {
      const capture: RawCapture = {
        sourceId: SourceId.parse("api-football"),
        capturedAt: ctx.now,
        requests: [],
      };
      if (ctx.matches.length === 0) return capture; // RN-08

      const get = async (query: string): Promise<RawRequest> => {
        const url = `${BASE_URL}/fixtures?${query}`;
        const res = await ctx.fetch(url, {
          method: "GET",
          headers: { "x-apisports-key": apiKey, "User-Agent": ctx.userAgent },
        });
        if (!res.ok) throw new Error(`api-football responded ${res.status}`);
        return {
          url,
          status: res.status,
          contentType: res.headers.get("content-type"),
          body: await res.text(),
        };
      };

      const now = Date.parse(ctx.now);
      const seen = new Set<string>();
      if (ctx.matches.some((m) => Date.parse(m.kickoff) <= now)) {
        const query = liveQuery(
          ctx.competitions
            .map((c) => LEAGUES[c])
            .filter((l): l is number => l !== undefined),
        );
        // null: fewer than two leagues in window, so there is no live= the
        // provider would accept (CA-1). ids= covers them all.
        if (query !== null) {
          const live = await get(query);
          capture.requests.push(live);
          for (const id of fixtureIdsIn(live.body)) seen.add(id);
        }
      } // else N-10: nothing has kicked off, ids= covers NS

      const pending = ctx.matches
        .map((m) => fixtureIdByMatchId.get(m.id))
        .filter((id): id is string => id !== undefined && !seen.has(id))
        .sort(ascending);
      for (let i = 0; i < pending.length; i += IDS_PER_REQUEST) {
        const chunk = pending.slice(i, i + IDS_PER_REQUEST);
        capture.requests.push(await get(`ids=${chunk.join("-")}`));
      }
      return capture;
    },

    parse(raw: RawCapture): ParseResult {
      // A fixture present in several requests counts once: the last wins.
      const fixtures = new Map<string, ProviderFixture>();
      for (const request of raw.requests) {
        const body = ProviderBody.parse(JSON.parse(request.body));
        if (hasErrors(body.errors))
          throw new Error(
            `api-football returned errors: ${JSON.stringify(body.errors)}`,
          );
        for (const f of body.response) fixtures.set(String(f.fixture.id), f);
      }

      const result: ParseResult = {
        observations: [],
        unresolved: [],
        skipped: [],
      };
      for (const [externalMatchId, f] of fixtures) {
        const short = f.fixture.status.short;
        const externalCompetition = String(f.league.id);
        const home = {
          externalId: String(f.teams.home.id),
          externalName: f.teams.home.name,
        };
        const away = {
          externalId: String(f.teams.away.id),
          externalName: f.teams.away.name,
        };
        const unresolved = (reason: Unresolved["reason"]) =>
          result.unresolved.push({
            reason,
            externalCompetition,
            externalMatchId,
            home,
            away,
            status: short,
          });
        const skipped = (reason: Skipped["reason"]) =>
          result.skipped.push({ externalMatchId, status: short, reason });

        // Identity first, all-or-nothing (RN-10).
        const competitionId = COMPETITION_OF_LEAGUE.get(Number(f.league.id));
        if (competitionId === undefined) {
          unresolved("unknown_competition");
          continue;
        }
        const homeId = teamByExternalId.get(home.externalId);
        const awayId = teamByExternalId.get(away.externalId);
        if (homeId === undefined || awayId === undefined) {
          unresolved("unknown_team");
          continue;
        }
        const matchId = aliases.matches?.[externalMatchId];
        if (matchId === undefined) {
          unresolved("unknown_match");
          continue;
        }
        if (
          !matchId.startsWith(`${competitionId}-`) ||
          !matchId.endsWith(`-${homeId}-${awayId}`)
        ) {
          unresolved("inconsistent_alias");
          continue;
        }

        const state = toState(short, f);
        if (state === null) {
          skipped("unsupported_status");
          continue;
        }
        if (state === "missing_score") {
          skipped("missing_score");
          continue;
        }
        result.observations.push({ matchId, ...state });
      }
      return result;
    },

    resolveTeam(external: string, _competition: CompetitionId): TeamId | null {
      return teamByExternalId.get(external) ?? null;
    },
  };
}

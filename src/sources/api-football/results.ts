import {
  type AliasFile,
  type CompetitionId,
  type FetchContext,
  type ParseResult,
  type RawCapture,
  type RawRequest,
  type SourceAdapter,
  SourceId,
  type TeamId,
} from "../../model/index.ts";
import { LEAGUES } from "./calendar.ts";

const BASE_URL = "https://v3.football.api-sports.io";
const IDS_PER_REQUEST = 20;

export type ApiFootballResultsOptions = {
  aliases: AliasFile;
  apiKey: string;
};

const ascending = (a: string, b: string) => Number(a) - Number(b);

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
        const leagues = [
          ...new Set(
            ctx.competitions
              .map((c) => LEAGUES[c])
              .filter((l): l is number => l !== undefined),
          ),
        ].sort((a, b) => a - b);
        const live = await get(`live=${leagues.join("-")}`);
        capture.requests.push(live);
        for (const id of fixtureIdsIn(live.body)) seen.add(id);
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

    parse(_raw: RawCapture): ParseResult {
      throw new Error("not implemented");
    },

    resolveTeam(external: string, _competition: CompetitionId): TeamId | null {
      return teamByExternalId.get(external) ?? null;
    },
  };
}

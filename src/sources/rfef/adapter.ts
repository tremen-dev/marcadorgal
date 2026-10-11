import {
  type AliasFile,
  type CompetitionId,
  type FetchContext,
  type Match,
  type ParseResult,
  type RawCapture,
  type RequestError,
  type SourceAdapter,
  SourceId,
  type TeamId,
  type Unresolved,
} from "../../model/index.ts";
import { RfefFormatError } from "./decode.ts";
import { type PanelRow, readPanel } from "./panel.ts";
import { rowState } from "./state.ts";

// Adapter of the RFEF panel, marcadores.rfef.es (ADR-017, SPEC-031). It is
// not registered: no request leaves production until the spec of its entry.

const ORIGIN = "https://marcadores.rfef.es";
export const PORTADA_URL = `${ORIGIN}/pnfg/`;
// ADR-018 §1 (supersedes ADR-017 §1): one POST, the query of ADR-017 §1 in
// the body, nothing in the url. The GET answers a cache (E-1).
export const PANEL_URL = `${ORIGIN}/pnfg/NPcd/NFG_CMP_Paneles`;
export const PANEL_QUERY =
  "cod_primaria=3001668&grupo_categoria=900163685,900163686&resultados=1&columna=1&extendido=1&no_paginacion=1&tipo_peticion=1&federacion=3";

// The panel of matches in play (ADR-019 §2): the same body plus one field.
export const PANEL_ENJUEGO_QUERY = `${PANEL_QUERY}&Sch_en_juego=1`;
export const PANEL_CONTENT_TYPE = "application/x-www-form-urlencoded";
// The declared identity (ADR-019 §6): the UA of the registry, never varied.
export const USER_AGENT = "marcador.gal (ingesta; https://marcador.gal)";

// The two requests of the source, shared with the calibration (SPEC-032 CA-2).
// The session comes from the portada, without following redirects.
export const portadaInit = (userAgent: string): RequestInit => ({
  method: "GET",
  redirect: "manual",
  headers: { "User-Agent": userAgent },
});

export const panelInit = (
  session: string,
  userAgent: string,
  body: string = PANEL_QUERY,
): RequestInit => ({
  method: "POST",
  redirect: "manual",
  headers: {
    "Content-Type": PANEL_CONTENT_TYPE,
    Cookie: `JSESSIONID=${session}`,
    "User-Agent": userAgent,
  },
  body,
});

const RFEF = SourceId.parse("rfef");

// The declared calendar the core injects (ADR-008 §8, ADR-017 §2).
export type DeclaredMatch = Pick<
  Match,
  "id" | "competitionId" | "round" | "homeTeamId" | "awayTeamId"
>;

export type RfefOptions = {
  aliases: AliasFile;
  calendar: readonly DeclaredMatch[];
};

// The team name is its externalId: trimmed, spaces collapsed, lower case, NFC.
export const normalizeName = (name: string): string =>
  name
    .normalize("NFC")
    .replace(/[\s ]+/g, " ")
    .trim()
    .toLowerCase();

const messageOf = (e: unknown): string => {
  const message = e instanceof Error ? e.message : String(e);
  return message.length > 0 ? message : "unreadable body";
};

export function charsetOf(contentType: string | null): string {
  const m = contentType?.match(/charset\s*=\s*"?([^";\s]+)"?/i);
  // The panel always declares it; ISO-8859-15 is what it sends (ADR-017).
  return m ? m[1] : "iso-8859-15";
}

export function sessionCookie(res: Response): string | null {
  const cookies =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [res.headers.get("set-cookie") ?? ""];
  for (const cookie of cookies) {
    const m = cookie.match(/(?:^|[;,]\s*)JSESSIONID=([^;,\s]+)/);
    if (m) return m[1];
  }
  return null;
}

export function createRfef({ aliases, calendar }: RfefOptions): SourceAdapter {
  const teamByName = new Map<string, TeamId>(
    aliases.teams.map((t) => [normalizeName(t.externalId), t.teamId]),
  );
  const competitionOf = new Map<string, CompetitionId>(
    Object.entries(aliases.competitions ?? {}),
  );
  const matchOf = new Map<string, DeclaredMatch>(
    calendar.map((m) => [
      `${m.competitionId}|${m.homeTeamId}|${m.awayTeamId}`,
      m,
    ]),
  );

  // One request, all or nothing (ADR-017 §3): any row it cannot read throws.
  function parseRequest(body: string, capturedAt: RawCapture["capturedAt"]) {
    const out: Omit<ParseResult, "requestErrors"> = {
      observations: [],
      unresolved: [],
      skipped: [],
    };
    // A 200 with nothing in it (ADR-018 §3): its own reason, not "not a panel".
    if (body.length === 0) throw new RfefFormatError("empty body");
    const panel = readPanel(body);
    if (!panel.codgrupos.some((g) => competitionOf.has(g)))
      throw new RfefFormatError("panel with no codgrupo of the map");
    for (const row of panel.rows) {
      const competitionId = competitionOf.get(row.codgrupo);
      if (competitionId === undefined) continue; // Copa, juveniles: ignored
      const state = rowState(row, capturedAt);
      if (state === null) continue; // "-": nothing to say
      const externalMatchId = row.acta?.acta ?? null;
      const unresolved = (reason: Unresolved["reason"]) =>
        out.unresolved.push({
          reason,
          externalCompetition: row.codgrupo,
          externalMatchId,
          home: { externalId: normalizeName(row.home), externalName: row.home },
          away: { externalId: normalizeName(row.away), externalName: row.away },
          status: row.cell.visible,
        });
      const match = resolveMatch(row, competitionId);
      if (typeof match === "string") {
        unresolved(match);
        continue;
      }
      if (typeof state === "string") {
        out.skipped.push({
          externalMatchId,
          status: row.cell.visible,
          reason: state,
        });
        continue;
      }
      out.observations.push({ matchId: match.id, ...state });
    }
    return out;
  }

  function resolveMatch(
    row: PanelRow,
    competitionId: CompetitionId,
  ): DeclaredMatch | Unresolved["reason"] {
    const home = teamByName.get(normalizeName(row.home));
    const away = teamByName.get(normalizeName(row.away));
    if (home === undefined || away === undefined) return "unknown_team";
    const match = matchOf.get(`${competitionId}|${home}|${away}`);
    if (match === undefined) return "unknown_match";
    if (match.round !== row.round) return "inconsistent_alias";
    return match;
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

      // The session: the portada, without following redirects. Its cookie
      // never reaches the raw capture.
      const portada = await ctx.fetch(PORTADA_URL, portadaInit(ctx.userAgent));
      const session = sessionCookie(portada);
      if (session === null)
        throw new Error(
          `rfef: no JSESSIONID from the portada (${portada.status})`,
        );

      const res = await ctx.fetch(
        PANEL_URL,
        panelInit(session, ctx.userAgent, PANEL_QUERY),
      );
      if (res.status < 200 || res.status > 299)
        throw new Error(`rfef responded ${res.status}`);
      const contentType = res.headers.get("content-type");
      // An empty 200 does not throw: it goes to the raw capture as evidence,
      // and parse turns it into "empty body" (ADR-018 §3).
      const body = new TextDecoder(charsetOf(contentType)).decode(
        await res.arrayBuffer(),
      );
      capture.requests.push({
        url: PANEL_URL,
        method: "POST",
        requestBody: PANEL_QUERY,
        status: res.status,
        contentType,
        body,
      });
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
        try {
          const out = parseRequest(request.body, raw.capturedAt);
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

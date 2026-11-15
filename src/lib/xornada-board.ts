import { seasonOf } from "../board/current.ts";
import { type IndexReader, readHome } from "../board/week-read.ts";
import type { Neighbours } from "../board/weeks.ts";
import type { Locale } from "../i18n/index.ts";
import type { AliasFile, Instant, PublicMatch } from "../model/index.ts";
import {
  EXPLORER_ENRICHMENT_TIMEOUT_MS,
  enrichMatchesWithGoals,
} from "./explorer-enrichment.ts";
import {
  clientExplorer,
  fetchWomenXornadaMatches,
  type WomenExplorer,
} from "./explorer-xornada.ts";

// SPEC-085 CA-2: the one read of the board behind /, /es and /api/board. The
// rows of web.xornada, their scorers from Explorer and the women xornada of
// Explorer; the women start at once, without waiting for the base or the
// scorers. Every dependency is given (reader, Explorer, now): no clock here.

export type BoardExplorer = WomenExplorer;

export type BoardReadDeps = {
  reader: IndexReader | null;
  explorer: BoardExplorer;
  now: Instant;
  aliases?: AliasFile | null;
  timeoutMs?: number;
};

export type BoardRead = { matches: PublicMatch[]; arrows: Neighbours };

// null: no reader, or the base failed (logged). A failure of Explorer never
// becomes a state (D-9): the rows stay without scorers, or without women.
export async function readXornadaBoard(
  deps: BoardReadDeps,
  locale: Locale,
): Promise<BoardRead | null> {
  const { reader, now } = deps;
  if (reader === null) return null;
  const timeoutMs = deps.timeoutMs ?? EXPLORER_ENRICHMENT_TIMEOUT_MS;
  const explorer = deps.explorer;

  const women = fetchWomenXornadaMatches(now, seasonOf(now), explorer, {
    timeoutMs,
  }).catch(() => [] as PublicMatch[]);

  let read: BoardRead;
  try {
    read = await readHome(reader, now, locale);
  } catch (e) {
    console.error(
      `xornada: read failed: ${e instanceof Error ? e.message : String(e)}`,
    );
    return null;
  }

  let matches = read.matches;
  try {
    matches = await enrichMatchesWithGoals(
      matches,
      explorer.dayMatches,
      deps.aliases ?? null,
      { timeoutMs },
    );
  } catch (_e) {
    // Graceful fallback: the rows without scorers.
  }

  const womenMatches = await women;
  return {
    matches: womenMatches.length > 0 ? [...matches, ...womenMatches] : matches,
    arrows: read.arrows,
  };
}

// Explorer as the render reads it (CA-3): every request with the deadline
// of the enrichment, which aborts the socket.
export const renderExplorer = (): BoardExplorer =>
  clientExplorer(EXPLORER_ENRICHMENT_TIMEOUT_MS);

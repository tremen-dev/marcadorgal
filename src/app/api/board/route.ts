import { boardResponse } from "@/board/http";
import { readPublicXornada, seasonOf } from "@/board/reader";
import { nowInstant } from "@/clock";
import { fetchWomenXornadaMatches } from "@/lib/explorer-xornada";
import type { Instant, PublicMatch } from "@/model";

// GET /api/board (SPEC-020 CA-7): the current xornada as { matches }, cached
// by the CDN (ADR-014 §6). Rendered per request; the cache lives in headers.
export const dynamic = "force-dynamic";

async function readBoard(now: Instant): Promise<PublicMatch[] | null> {
  const matches = await readPublicXornada(now);
  if (matches === null) return null;
  try {
    const womenMatches = await fetchWomenXornadaMatches(now, seasonOf(now));
    if (womenMatches.length > 0) {
      return [...matches, ...womenMatches];
    }
  } catch (_e) {
    // Graceful fallback: maintain existing matches
  }
  return matches;
}

export function GET(request: Request): Promise<Response> {
  return boardResponse(
    readBoard,
    nowInstant(),
    request.headers.get("if-none-match"),
  );
}

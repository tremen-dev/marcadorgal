import { boardResponse } from "@/board/http";
import { publicXornadaReader, seasonOf } from "@/board/reader";
import { nowInstant } from "@/clock";
import { rfefAliasesOrNull } from "@/ingest/aliases";
import { readXornadaBoard, renderExplorer } from "@/lib/xornada-board";
import type { Instant, PublicMatch } from "@/model";

// GET /api/board (SPEC-020 CA-7): the current xornada as { matches }, cached
// by the CDN (ADR-014 §6). Rendered per request; the cache lives in headers.
export const dynamic = "force-dynamic";

// SPEC-085 CA-2: the same read as / and /es. No reader: null (503, «not
// set»); a failed base: thrown, so the 503 says «read failed» as before.
async function readBoard(now: Instant): Promise<PublicMatch[] | null> {
  const reader = publicXornadaReader();
  if (reader === null) return null;
  const read = await readXornadaBoard(
    {
      reader,
      explorer: renderExplorer,
      now,
      aliases: rfefAliasesOrNull(seasonOf(now)),
    },
    "gl",
  );
  if (read === null) throw new Error("the public reader failed");
  return read.matches;
}

export function GET(request: Request): Promise<Response> {
  return boardResponse(
    readBoard,
    nowInstant(),
    request.headers.get("if-none-match"),
  );
}

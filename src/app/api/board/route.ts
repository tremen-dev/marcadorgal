import { boardResponse } from "@/board/http";
import { readPublicXornada } from "@/board/reader";
import { nowInstant } from "@/clock";

// GET /api/board (SPEC-020 CA-7): the current xornada as { matches }, cached
// by the CDN (ADR-014 §6). Rendered per request; the cache lives in headers.
export const dynamic = "force-dynamic";

export function GET(request: Request): Promise<Response> {
  return boardResponse(
    readPublicXornada,
    nowInstant(),
    request.headers.get("if-none-match"),
  );
}

import { createHash } from "node:crypto";
import type { Instant, PublicMatch } from "../model/index.ts";

// GET /api/board (SPEC-020 CA-7, ADR-014 §6): the same selection as the page,
// cached by the CDN for 10 s and served stale for 30 more while it refreshes.
// The ETag is a hash of the body (N-3): the highest version would miss a new
// Decision of a match with fewer versions.

export const BOARD_CACHE_CONTROL =
  "public, s-maxage=10, stale-while-revalidate=30";

// null: there is no reader (DATABASE_URL_PUBLIC missing).
export type ReadXornada = (now: Instant) => Promise<PublicMatch[] | null>;

const etagOf = (body: string): string =>
  `"${createHash("sha256").update(body).digest("base64url")}"`;

const bodyOf = (matches: readonly PublicMatch[]): string =>
  JSON.stringify({ matches });

// SPEC-024 CA-7: the ETag of a xornada, the same /api/board would give.
export const boardEtag = (matches: readonly PublicMatch[]): string =>
  etagOf(bodyOf(matches));

// If-None-Match uses the weak comparison (RFC 9110 §13.1.2): W/ is ignored.
function notModified(header: string | null, etag: string): boolean {
  if (header === null) return false;
  if (header.trim() === "*") return true;
  return header
    .split(",")
    .map((tag) => tag.trim().replace(/^W\//, ""))
    .includes(etag);
}

function unavailable(): Response {
  return Response.json(
    { error: "unavailable" },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

export async function boardResponse(
  read: ReadXornada,
  now: Instant,
  ifNoneMatch: string | null,
): Promise<Response> {
  let matches: PublicMatch[] | null;
  try {
    matches = await read(now);
  } catch (e) {
    console.error(
      `/api/board: read failed: ${e instanceof Error ? e.message : String(e)}`,
    );
    return unavailable();
  }
  if (matches === null) {
    console.error("/api/board: DATABASE_URL_PUBLIC is not set");
    return unavailable();
  }
  const body = bodyOf(matches);
  const etag = etagOf(body);
  const headers = {
    "Cache-Control": BOARD_CACHE_CONTROL,
    ETag: etag,
  };
  if (notModified(ifNoneMatch, etag))
    return new Response(null, { status: 304, headers });
  return new Response(body, {
    status: 200,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });
}

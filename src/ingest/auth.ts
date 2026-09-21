import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import type { Env } from "../db/env.ts";

// Authentication of the tick (ADR-008 §1): a bearer token of at least thirty
// two characters compared in constant time. Without a token the endpoint does
// not run: never a tick without a key.
export const TOKEN_MIN_LENGTH = 32;

export type TickAuthorization = "ok" | "unauthorized" | "unconfigured";

export function authorizeTick(
  header: string | null,
  env: Env,
): TickAuthorization {
  const token = env.INGEST_TICK_TOKEN;
  if (token === undefined || token.length < TOKEN_MIN_LENGTH)
    return "unconfigured";
  if (header === null) return "unauthorized";

  const parts = header.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return "unauthorized";

  const given = Buffer.from(parts[1], "utf8");
  const expected = Buffer.from(token, "utf8");
  // timingSafeEqual throws on different lengths, so the length is checked
  // first; a length leak is not a secret leak.
  if (given.length !== expected.length) return "unauthorized";
  return timingSafeEqual(given, expected) ? "ok" : "unauthorized";
}

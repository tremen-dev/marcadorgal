import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Env } from "../db/env.ts";
import type { Instant } from "../model/index.ts";

// Authentication of the tick (ADR-008 §1): a bearer token of at least thirty
// two characters compared in constant time. Without a token the endpoint does
// not run: never a tick without a key.
export const TOKEN_MIN_LENGTH = 32;

// ADR-015 §2 (SPEC-020 CA-9): pg_cron never sends the token, because the
// request it enqueues is readable by any login through PUBLIC on net. It
// sends t1.<epoch>.<hmac-sha256 hex of "t1.<epoch>" keyed with the token>,
// valid for SIGNATURE_WINDOW_S seconds either side of now.
export const SIGNATURE_WINDOW_S = 60;
const SIGNED = /^t1\.(\d{1,12})\.([0-9a-f]{64})$/;

export type TickAuthorization = "ok" | "unauthorized" | "unconfigured";

// Equal-length buffers compared in constant time; timingSafeEqual throws on
// different lengths, so the length is checked first: a length leak is not a
// secret leak.
function sameBytes(a: string, b: string): boolean {
  const given = Buffer.from(a, "utf8");
  const expected = Buffer.from(b, "utf8");
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}

function validSignature(bearer: string, token: string, now: Instant): boolean {
  const match = SIGNED.exec(bearer);
  if (match === null) return false;
  const nowMs = Date.parse(now);
  if (Number.isNaN(nowMs)) return false;
  const epoch = Number(match[1]);
  if (Math.abs(Math.floor(nowMs / 1000) - epoch) > SIGNATURE_WINDOW_S)
    return false;
  const expected = createHmac("sha256", token)
    .update(`t1.${match[1]}`)
    .digest("hex");
  return sameBytes(match[2], expected);
}

export function authorizeTick(
  header: string | null,
  env: Env,
  now: Instant,
): TickAuthorization {
  const token = env.INGEST_TICK_TOKEN;
  if (token === undefined || token.length < TOKEN_MIN_LENGTH)
    return "unconfigured";
  if (header === null) return "unauthorized";

  const parts = header.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return "unauthorized";

  const bearer = parts[1];
  // The static bearer: Vercel Cron and tick:salud, which never touch the
  // database. Otherwise, the signature of pg_cron.
  if (sameBytes(bearer, token)) return "ok";
  return validSignature(bearer, token, now) ? "ok" : "unauthorized";
}

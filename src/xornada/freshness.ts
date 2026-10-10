import type { PublicMatch } from "@/model";

// SPEC-024 CA-8 and CA-9 (D-9, RN-11): the three clocks never mix. The
// screen line uses the browser's (last response received); a row, the
// source's (observedAt). Pure: `now` and `last` are given, in ms.

const MINUTE_MS = 60_000;

export type ScreenFreshness =
  | { key: "freshness.now" }
  | { key: "freshness.ago"; n: number };

// «Actualizado agora» under a minute, «hai N min» after, minutes down.
export function screenFreshness(last: number, now: number): ScreenFreshness {
  const elapsed = now - last;
  if (elapsed < MINUTE_MS) return { key: "freshness.now" };
  return { key: "freshness.ago", n: Math.floor(elapsed / MINUTE_MS) };
}

// SPEC-027 CA-5 (H-4): a week page is a snapshot. Served (and before the
// browser clock is read) it says «Actualizado ás HH:MM»; after a minute,
// «hai N min» counted from that instant. Never a transport notice.
export type SnapshotFreshness =
  | { key: "freshness.servedAt" }
  | { key: "freshness.ago"; n: number };

export function snapshotFreshness(
  servedAt: number,
  now: number | null,
): SnapshotFreshness {
  if (now === null || now - servedAt < MINUTE_MS)
    return { key: "freshness.servedAt" };
  return { key: "freshness.ago", n: Math.floor((now - servedAt) / MINUTE_MS) };
}

// How the screen is being kept up to date (CA-6, CA-7). `connecting` is the
// first wait for SUBSCRIBED: nothing is said until it fails. After a failure
// the retries stay `polling`, the effective source, so the notice stays.
export type TransportMode = "polling" | "connecting" | "realtime";

export type TransportNoticeKey = "freshness.offline" | "freshness.polling";

// H-5: words, never a status colour. With the switch off polling is the
// normal mode and is not announced; without connection it is said in both.
// SPEC-029 CA-6 (V-7): while the transport has not loaded (`started` false)
// the screen is the served snapshot and nothing is announced. The page passes
// it; the transport, which only exists once started, may leave it out.
export function transportNotice(state: {
  realtime: boolean;
  mode: TransportMode;
  offline: boolean;
  started?: boolean;
}): TransportNoticeKey | null {
  if (state.started === false) return null;
  if (state.offline) return "freshness.offline";
  if (state.realtime && state.mode === "polling") return "freshness.polling";
  return null;
}

// CA-9 (H-4): only a live row (half-time and sen_sinal included) whose last
// observation is 2 min old or more says its age.
export const ROW_AGE_MIN_MS = 2 * MINUTE_MS;

export function rowAge(match: PublicMatch, now: number): number | null {
  if (match.status !== "live" || match.observedAt === null) return null;
  const elapsed = now - Date.parse(match.observedAt);
  if (elapsed < ROW_AGE_MIN_MS) return null;
  return Math.floor(elapsed / MINUTE_MS);
}

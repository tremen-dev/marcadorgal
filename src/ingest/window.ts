import {
  type Instant,
  type MatchStatus,
  MINUTE_MS,
  shiftInstant,
} from "../model/index.ts";
import {
  EXTENSION_AFTER_MINUTES,
  EXTENSION_POLL_MINUTES,
  WINDOW_AFTER_MINUTES,
  WINDOW_BEFORE_MINUTES,
} from "./constants.ts";

// forcedFinish is the mark of the current Decision (SPEC-014 CA-8), null when
// there is none or it predates the column: only true tells a finished RN-02
// forced from one the source confirmed. The rule says nothing here: a
// correction of replay:jornada also carries RN-02 and is no forced finish.
export type WindowInput = {
  kickoff: Instant;
  status: MatchStatus;
  forcedFinish: boolean | null;
  // When the current Decision was decided, null without one: it tells a live
  // or a forced finish decided in the extension (SPEC-018 CA-2).
  decidedAt: Instant | null;
};

// Window of ADR-002 §2, pure: now is given, never read. A match leaves the
// window by time or by a confirmed finished decision, and nothing else
// (ADR-008 §2). "Confirmed" is any finished without the mark, whatever its
// qualifier (SPEC-014 CA-9). A finished forced by RN-02 is provisional and keeps the match
// in window until the time edge, so the final the source confirms later can
// still be heard (ADR-010 §3, RN-12). Compared as milliseconds, not as text:
// two spellings of the same instant must not order differently.
//
// Since ADR-013 §1 (SPEC-018 CA-2) a match still scheduled at +150 —the board
// reads a match without a Decision as scheduled— is extended until +360: the
// source did not give it live and its final may come late. A live decided in
// the extension stays too, and so does the finished RN-02 forces from it in
// the same tick, so RN-12 can hear the FT of the source (N-4). A live or a
// forced finish decided before +150, a postponed or a suspended leave at +150
// as before.
export function isInWindow(
  { kickoff, status, forcedFinish, decidedAt }: WindowInput,
  now: Instant,
): boolean {
  if (status === "finished" && forcedFinish !== true) return false;
  const kickoffMs = Date.parse(kickoff);
  const nowMs = Date.parse(now);
  if (nowMs < kickoffMs - WINDOW_BEFORE_MINUTES * MINUTE_MS) return false;
  if (nowMs < kickoffMs + WINDOW_AFTER_MINUTES * MINUTE_MS) return true;
  if (!isInExtension({ kickoff }, now)) return false;
  if (status === "scheduled") return true;
  if (status !== "live" && status !== "finished") return false;
  return (
    decidedAt !== null &&
    Date.parse(decidedAt) >= kickoffMs + WINDOW_AFTER_MINUTES * MINUTE_MS
  );
}

// The extension proper, [+150, +360), whatever the status: isInWindow has
// already decided whether the match is in.
export function isInExtension(
  { kickoff }: { kickoff: Instant },
  now: Instant,
): boolean {
  const kickoffMs = Date.parse(kickoff);
  const nowMs = Date.parse(now);
  return (
    kickoffMs + WINDOW_AFTER_MINUTES * MINUTE_MS <= nowMs &&
    nowMs < kickoffMs + EXTENSION_AFTER_MINUTES * MINUTE_MS
  );
}

// Whether a match in window is asked for in this tick (ADR-013 §1, H-2). In
// the regular window every tick asks, under the cadence of the source (RN-08).
// In the extension only when its last observation —received_at, our clock—
// is at least EXTENSION_POLL_MINUTES old, or there is none.
export function isDueForPoll(
  {
    kickoff,
    lastObservationAt,
  }: { kickoff: Instant; lastObservationAt: Instant | null },
  now: Instant,
): boolean {
  if (!isInExtension({ kickoff }, now)) return true;
  if (lastObservationAt === null) return true;
  return (
    Date.parse(now) - Date.parse(lastObservationAt) >=
    EXTENSION_POLL_MINUTES * MINUTE_MS
  );
}

// The same window read as bounds on kickoff, to narrow the board query before
// isInWindow filters it (CA-6). It reaches back to the end of the extension.
export function windowKickoffRange(now: Instant): {
  from: Instant;
  to: Instant;
} {
  return {
    from: shiftInstant(now, -EXTENSION_AFTER_MINUTES * MINUTE_MS),
    to: shiftInstant(now, WINDOW_BEFORE_MINUTES * MINUTE_MS),
  };
}

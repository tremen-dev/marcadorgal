import {
  type Instant,
  type MatchStatus,
  MINUTE_MS,
  shiftInstant,
} from "../model/index.ts";
import { WINDOW_AFTER_MINUTES, WINDOW_BEFORE_MINUTES } from "./constants.ts";

export type WindowInput = { kickoff: Instant; status: MatchStatus };

// Window of ADR-002 §2, pure: now is given, never read. A match leaves the
// window by time or by a finished decision, and nothing else (ADR-008 §2).
// Compared as milliseconds, not as text: two spellings of the same instant
// must not order differently.
export function isInWindow(
  { kickoff, status }: WindowInput,
  now: Instant,
): boolean {
  if (status === "finished") return false;
  const kickoffMs = Date.parse(kickoff);
  const nowMs = Date.parse(now);
  return (
    kickoffMs - WINDOW_BEFORE_MINUTES * MINUTE_MS <= nowMs &&
    nowMs < kickoffMs + WINDOW_AFTER_MINUTES * MINUTE_MS
  );
}

// The same window read as bounds on kickoff, to narrow the board query before
// isInWindow filters it (CA-6).
export function windowKickoffRange(now: Instant): {
  from: Instant;
  to: Instant;
} {
  return {
    from: shiftInstant(now, -WINDOW_AFTER_MINUTES * MINUTE_MS),
    to: shiftInstant(now, WINDOW_BEFORE_MINUTES * MINUTE_MS),
  };
}

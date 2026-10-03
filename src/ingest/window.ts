import {
  type DecisionRule,
  type Instant,
  type MatchStatus,
  MINUTE_MS,
  shiftInstant,
} from "../model/index.ts";
import { WINDOW_AFTER_MINUTES, WINDOW_BEFORE_MINUTES } from "./constants.ts";

// rule is the one of the current Decision, null when there is none: it is
// what tells a finished the source confirmed from one RN-02 forced.
export type WindowInput = {
  kickoff: Instant;
  status: MatchStatus;
  rule: DecisionRule | null;
};

// Window of ADR-002 §2, pure: now is given, never read. A match leaves the
// window by time or by a confirmed finished decision, and nothing else
// (ADR-008 §2). A finished forced by RN-02 is provisional and keeps the match
// in window until the time edge, so the final the source confirms later can
// still be heard (ADR-010 §3, RN-12). Compared as milliseconds, not as text:
// two spellings of the same instant must not order differently.
export function isInWindow(
  { kickoff, status, rule }: WindowInput,
  now: Instant,
): boolean {
  if (status === "finished" && rule !== "RN-02") return false;
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

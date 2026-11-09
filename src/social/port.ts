import type { Instant, Score } from "../model/index.ts";

// SPEC-066 (ADR-030 §3): the port of the outbox the dispatcher speaks to.
// CI proves the dispatcher with the memory implementation (memory.ts) and
// npm run test:db proves the postgres.js one (db.ts). The dispatcher never
// sees SQL, a Date or the wall clock.

export const SIDES = ["home", "away"] as const;
export type Side = (typeof SIDES)[number];

export const POST_KINDS = ["goal", "goal_annulled"] as const;
export type PostKind = (typeof POST_KINDS)[number];

export const POST_STATUSES = [
  "pending",
  "sending",
  "sent",
  "failed",
  "expired",
  "skipped",
] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

// Why a row never reached the publisher (CA-7, CA-10).
export type SkipReason = "not_watched" | "goal_not_posted" | "disabled";

// Why a row failed (CA-5, CA-6).
export type FailReason = "rejected" | "attempts_exhausted" | "unknown_outcome";

export type TeamRef = { id: string; name: string };

// A pending row with everything the dispatcher needs to decide about it,
// read under the lock of the claim.
export type PendingPost = {
  id: string;
  matchId: string;
  side: Side;
  kind: PostKind;
  // Attempts before this claim.
  attempts: number;
  // The text fixed on a previous claim (a retry), or null.
  text: string | null;
  templateId: string | null;
  season: string;
  home: TeamRef;
  away: TeamRef;
  // From the Decision the row cites.
  score: Score;
  minute: number | null;
  addedMinute: number | null;
  // The newest goal row of the same match and side, this one aside.
  lastGoal: { status: PostStatus; reason: string | null } | null;
  // The template of the newest text of the same kind for the team of the
  // side, and of the newest text of the account (CA-9).
  lastTemplateOfTeam: string | null;
  lastTemplateOfAccount: string | null;
};

export type ClaimOutcome =
  | {
      kind: "skip";
      reason: SkipReason;
      text: string | null;
      templateId: string | null;
    }
  | { kind: "send"; text: string; templateId: string };

export type FinishResult =
  | { status: "sent"; provider: string; providerPostId: string }
  | { status: "failed"; reason: FailReason }
  // Back to pending for the next tick, text kept.
  | { status: "pending" };

export interface SocialDb {
  // CA-6: open rows whose Decision is older than cutoff. pending -> expired,
  // sending -> failed (unknown_outcome). Returns how many of each.
  expire(cutoff: Instant): Promise<{ expired: number; failed: number }>;
  // Claims the oldest pending row in a short transaction of its own: locks
  // it (skip locked), hands it to `decide` and writes the outcome: skip
  // closes the row; send puts it in sending with attempts + 1 and the text
  // fixed. null when nothing is pending.
  claim(
    decide: (post: PendingPost) => ClaimOutcome,
  ): Promise<{ post: PendingPost; outcome: ClaimOutcome } | null>;
  // The result of the publisher for a row in sending.
  finish(postId: string, result: FinishResult): Promise<void>;
}

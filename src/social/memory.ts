import type { Instant, Score } from "../model/index.ts";
import type {
  PendingPost,
  PostKind,
  PostStatus,
  Side,
  SocialDb,
  TeamRef,
} from "./port.ts";

// The in-memory SocialDb (SPEC-066 CA-5..CA-7): a row of social_posts with
// the context the postgres.js implementation reads through its joins. The
// tests seed these; the dispatcher never knows which implementation it has.
export type MemoryPost = {
  id: string;
  decisionId: string;
  matchId: string;
  side: Side;
  kind: PostKind;
  status: PostStatus;
  attempts: number;
  reason: string | null;
  templateId: string | null;
  text: string | null;
  provider: string | null;
  providerPostId: string | null;
  createdAt: Instant;
  closedAt: Instant | null;
  // decisions.decided_at of the Decision the row cites.
  decidedAt: Instant;
  season: string;
  home: TeamRef;
  away: TeamRef;
  score: Score;
  minute: number | null;
  addedMinute: number | null;
};

export type MemorySocialDb = SocialDb & { posts: MemoryPost[] };

const byCreation = (a: MemoryPost, b: MemoryPost) =>
  a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;

const teamOf = (post: MemoryPost): string =>
  post.side === "home" ? post.home.id : post.away.id;

// closedAt is Postgres's clock_timestamp() in the real table (ADR-016); the
// double seals a fixed marker, enough to tell closed from open.
const CLOSED = "1970-01-01T00:00:00.000Z" as Instant;

export function createMemorySocialDb(posts: MemoryPost[]): MemorySocialDb {
  const newest = (filter: (p: MemoryPost) => boolean): MemoryPost | undefined =>
    posts.filter(filter).sort(byCreation).at(-1);

  const context = (post: MemoryPost): PendingPost => {
    const team = teamOf(post);
    const lastGoal = newest(
      (p) =>
        p.id !== post.id &&
        p.matchId === post.matchId &&
        p.side === post.side &&
        p.kind === "goal",
    );
    const lastOfTeam = newest(
      (p) =>
        p.id !== post.id &&
        p.templateId !== null &&
        p.kind === post.kind &&
        teamOf(p) === team,
    );
    const lastOfAccount = newest(
      (p) => p.id !== post.id && p.templateId !== null,
    );
    return {
      id: post.id,
      matchId: post.matchId,
      side: post.side,
      kind: post.kind,
      attempts: post.attempts,
      text: post.text,
      templateId: post.templateId,
      season: post.season,
      home: post.home,
      away: post.away,
      score: post.score,
      minute: post.minute,
      addedMinute: post.addedMinute,
      lastGoal:
        lastGoal === undefined
          ? null
          : { status: lastGoal.status, reason: lastGoal.reason },
      lastTemplateOfTeam: lastOfTeam?.templateId ?? null,
      lastTemplateOfAccount: lastOfAccount?.templateId ?? null,
    };
  };

  return {
    posts,

    async expire(cutoff) {
      let expired = 0;
      let failed = 0;
      for (const post of posts) {
        if (post.decidedAt >= cutoff) continue;
        if (post.status === "pending") {
          post.status = "expired";
          post.closedAt = CLOSED;
          expired += 1;
        } else if (post.status === "sending") {
          post.status = "failed";
          post.reason = "unknown_outcome";
          post.closedAt = CLOSED;
          failed += 1;
        }
      }
      return { expired, failed };
    },

    async claim(decide) {
      const next = posts
        .filter((p) => p.status === "pending")
        .sort(byCreation)[0];
      if (next === undefined) return null;
      const post = context(next);
      const outcome = decide(post);
      if (outcome.kind === "skip") {
        next.status = "skipped";
        next.reason = outcome.reason;
        next.text = outcome.text;
        next.templateId = outcome.templateId;
        next.closedAt = CLOSED;
      } else {
        next.status = "sending";
        next.attempts += 1;
        next.text = outcome.text;
        next.templateId = outcome.templateId;
      }
      return { post, outcome };
    },

    async finish(postId, result) {
      const post = posts.find((p) => p.id === postId);
      if (post === undefined || post.status !== "sending") return;
      if (result.status === "sent") {
        post.status = "sent";
        post.provider = result.provider;
        post.providerPostId = result.providerPostId;
        post.closedAt = CLOSED;
      } else if (result.status === "failed") {
        post.status = "failed";
        post.reason = result.reason;
        post.closedAt = CLOSED;
      } else {
        post.status = "pending";
      }
    },
  };
}

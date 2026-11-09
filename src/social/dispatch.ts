import { GOAL_ANNULLED_TEMPLATES, GOAL_TEMPLATES } from "../i18n/social.gl.ts";
import { type Instant, MINUTE_MS, shiftInstant } from "../model/index.ts";
import { type SocialConfig, watchedTeams } from "./config.ts";
import { pickTemplate, type Rng } from "./pick.ts";
import type { ClaimOutcome, PendingPost, SocialDb } from "./port.ts";
import type { PublishResult, SocialPublisher } from "./publisher.ts";
import { renderSocialText } from "./text.ts";

// SPEC-066 CA-5, CA-6, CA-7 (ADR-030 §3, §4, §6, §7): the publisher at the
// end of every tick. Row by row, oldest first: claim in a short transaction
// (the text is fixed there, once), call the provider outside any
// transaction, write the result. Nothing here opens an alert or touches a
// Decision (D-9). The clock is `now`, the tick's (ADR-008 §7); the only
// timer is the timeout of a call.

// ADR-030 §4: posts per tick, seconds per call, minutes a row lives,
// attempts per row.
export const MAX_POSTS_PER_TICK = 4;
export const PUBLISH_TIMEOUT_MS = 5_000;
export const POST_TTL_MINUTES = 10;
export const MAX_ATTEMPTS = 3;

// A guard against a loop over a flood of skippable rows: the expiry bounds
// the open rows anyway, so this is never reached in practice.
const MAX_CLAIMS_PER_TICK = 200;

export type SocialCounts = {
  sent: number;
  failed: number;
  retried: number;
  expired: number;
  skipped: number;
};

export type DispatchInput = {
  db: SocialDb;
  // null: off, the dry mode of CA-10. Every watched row is redacted and
  // closed as skipped (disabled) without a call.
  publisher: SocialPublisher | null;
  config: SocialConfig;
  now: Instant;
  rng: Rng;
  timeoutMs?: number;
  maxPosts?: number;
};

export async function dispatchSocial(
  input: DispatchInput,
): Promise<SocialCounts> {
  const { db, publisher, config, now, rng } = input;
  const timeoutMs = input.timeoutMs ?? PUBLISH_TIMEOUT_MS;
  const maxPosts = input.maxPosts ?? MAX_POSTS_PER_TICK;
  const counts: SocialCounts = {
    sent: 0,
    failed: 0,
    retried: 0,
    expired: 0,
    skipped: 0,
  };

  // CA-6: what is older than the TTL never reaches the publisher.
  const stale = await db.expire(
    shiftInstant(now, -POST_TTL_MINUTES * MINUTE_MS),
  );
  counts.expired += stale.expired;
  counts.failed += stale.failed;

  let calls = 0;
  for (let i = 0; i < MAX_CLAIMS_PER_TICK && calls < maxPosts; i += 1) {
    const claimed = await db.claim((post) =>
      decideClaim(post, publisher !== null, config, rng),
    );
    if (claimed === null) break;
    const { post, outcome } = claimed;
    if (outcome.kind === "skip") {
      counts.skipped += 1;
      continue;
    }
    // Unreachable with publisher null: decideClaim skips every row then.
    if (publisher === null) break;
    calls += 1;
    const result = await publishWithTimeout(publisher, outcome.text, timeoutMs);
    if (result.outcome === "sent") {
      await db.finish(post.id, {
        status: "sent",
        provider: publisher.id,
        providerPostId: result.providerPostId,
      });
      counts.sent += 1;
    } else if (result.outcome === "rejected") {
      await db.finish(post.id, { status: "failed", reason: "rejected" });
      counts.failed += 1;
    } else if (result.outcome === "unknown") {
      // H-4: a lost tweet before a duplicated one.
      await db.finish(post.id, { status: "failed", reason: "unknown_outcome" });
      counts.failed += 1;
    } else if (post.attempts + 1 >= MAX_ATTEMPTS) {
      await db.finish(post.id, {
        status: "failed",
        reason: "attempts_exhausted",
      });
      counts.failed += 1;
    } else {
      // The provider asks for patience: this row waits for the next tick,
      // and so does everything behind it (ADR-030 §4).
      await db.finish(post.id, { status: "pending" });
      counts.retried += 1;
      break;
    }
  }
  return counts;
}

// What happens to a claimed row before any call, in order (CA-7, CA-10,
// CA-9, ADR-030 §6). Pure: the RNG is the only effect.
export function decideClaim(
  post: PendingPost,
  enabled: boolean,
  config: SocialConfig,
  rng: Rng,
): ClaimOutcome {
  // A retry: the text was fixed on the first claim and goes out as is.
  if (post.text !== null && post.templateId !== null)
    return enabled
      ? { kind: "send", text: post.text, templateId: post.templateId }
      : {
          kind: "skip",
          reason: "disabled",
          text: post.text,
          templateId: post.templateId,
        };
  const team = post.side === "home" ? post.home : post.away;
  if (!watchedTeams(config, post.season).has(team.id))
    return {
      kind: "skip",
      reason: "not_watched",
      text: null,
      templateId: null,
    };
  if (post.kind === "goal_annulled" && !wentOut(post.lastGoal))
    return {
      kind: "skip",
      reason: "goal_not_posted",
      text: null,
      templateId: null,
    };
  const candidates =
    post.kind === "goal" ? GOAL_TEMPLATES : GOAL_ANNULLED_TEMPLATES;
  const excluded = new Set(
    [post.lastTemplateOfTeam, post.lastTemplateOfAccount].filter(
      (id): id is string => id !== null,
    ),
  );
  const template = pickTemplate(candidates, excluded, rng);
  const text = renderSocialText(template, {
    team: team.name,
    home: post.home.name,
    away: post.away.name,
    score: post.score,
    minute: post.minute,
    addedMinute: post.addedMinute,
    link: config.linkUrl,
  });
  return enabled
    ? { kind: "send", text, templateId: template.id }
    : { kind: "skip", reason: "disabled", text, templateId: template.id };
}

// CA-7: the annulment only goes out when the goal did: sent, or redacted in
// dry mode (then the correction is redacted too).
const wentOut = (last: PendingPost["lastGoal"]): boolean =>
  last !== null &&
  (last.status === "sent" ||
    (last.status === "skipped" && last.reason === "disabled"));

// CA-6: a call that neither answers nor fails within the timeout is unknown,
// and so is one that throws (network): nobody knows whether it went out.
async function publishWithTimeout(
  publisher: SocialPublisher,
  text: string,
  timeoutMs: number,
): Promise<PublishResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<PublishResult>((resolve) => {
    timer = setTimeout(
      () => resolve({ outcome: "unknown", reason: `timeout ${timeoutMs} ms` }),
      timeoutMs,
    );
  });
  const call = publisher.publish(text).then(
    (result) => result,
    (e: unknown): PublishResult => ({
      outcome: "unknown",
      reason: e instanceof Error ? e.message : String(e),
    }),
  );
  try {
    return await Promise.race([call, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

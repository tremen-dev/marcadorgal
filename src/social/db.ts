import type { Sql, TransactionSql } from "postgres";
import type {
  ClaimOutcome,
  FinishResult,
  PendingPost,
  PostKind,
  PostStatus,
  Side,
  SocialDb,
} from "./port.ts";

// SPEC-066 (ADR-030 §3): the postgres.js SocialDb. Every statement of the
// outbox lives here. Timestamps are sealed by Postgres (clock_timestamp(),
// ADR-016, ADR-030 §9); this layer never reads them and no Date leaves it.
// Nothing here touches decisions or alerts beyond reading one row (D-9).

type ContextRow = {
  id: string;
  match_id: string;
  side: Side;
  kind: PostKind;
  attempts: number;
  text: string | null;
  template_id: string | null;
  season: string;
  home_team_id: string;
  away_team_id: string;
  home_name: string;
  away_name: string;
  home_score: number | null;
  away_score: number | null;
  minute: number | null;
  added_minute: number | null;
};

type Queryable = Sql | TransactionSql;

// A short transaction of its own, or a savepoint when the caller already
// holds one (the rolled-back tests): postgres.js gives one or the other.
const transaction = <T>(
  sql: Queryable,
  fn: (tx: TransactionSql) => Promise<T>,
): Promise<T> =>
  "savepoint" in sql
    ? ((sql as TransactionSql).savepoint(fn) as Promise<T>)
    : ((sql as Sql).begin(fn) as Promise<T>);

export function createSocialDb(sql: Queryable): SocialDb {
  return {
    // CA-6, ADR-030 §4: with the cutoff of the tick, never the wall clock.
    async expire(cutoff) {
      const rows = await sql<{ status: PostStatus }[]>`
        update social_posts p set
          status = case when p.status = 'pending' then 'expired' else 'failed' end,
          reason = case when p.status = 'sending' then 'unknown_outcome' else p.reason end,
          closed_at = clock_timestamp()
        from decisions d
        where d.id = p.decision_id
          and p.status in ('pending', 'sending')
          and d.decided_at < ${cutoff}
        returning p.status`;
      return {
        expired: rows.filter((r) => r.status === "expired").length,
        failed: rows.filter((r) => r.status === "failed").length,
      };
    },

    // ADR-030 §3: the claim. "for update skip locked" is what lets two
    // dispatches (pg_cron and Vercel Cron) share the queue without ever
    // taking the same row; the row leaves pending before the commit, so the
    // other one never sees it again.
    claim(decide) {
      return transaction(sql, async (tx) => {
        const [next] = await tx<{ id: string }[]>`
          select id from social_posts where status = 'pending'
          order by created_at, id limit 1
          for update skip locked`;
        if (next === undefined) return null;
        const post = await context(tx, next.id);
        const outcome = decide(post);
        if (outcome.kind === "skip")
          await tx`update social_posts set status = 'skipped',
              reason = ${outcome.reason}, text = ${outcome.text},
              template_id = ${outcome.templateId}, closed_at = clock_timestamp()
            where id = ${post.id}`;
        else
          await tx`update social_posts set status = 'sending',
              attempts = attempts + 1, text = ${outcome.text},
              template_id = ${outcome.templateId}
            where id = ${post.id}`;
        return { post, outcome };
      });
    },

    // Only a row in sending has a result to write: anything else (a row the
    // expiry closed meanwhile) keeps what it has.
    async finish(postId, result) {
      if (result.status === "sent")
        await sql`update social_posts set status = 'sent',
            provider = ${result.provider},
            provider_post_id = ${result.providerPostId},
            closed_at = clock_timestamp()
          where id = ${postId} and status = 'sending'`;
      else if (result.status === "failed")
        await sql`update social_posts set status = 'failed',
            reason = ${result.reason}, closed_at = clock_timestamp()
          where id = ${postId} and status = 'sending'`;
      else
        await sql`update social_posts set status = 'pending'
          where id = ${postId} and status = 'sending'`;
    },
  };
}

// Everything the dispatcher decides with (port.ts PendingPost), read under
// the lock of the claim: the match and its teams, the Decision the row
// cites, the last goal of the same match and side, and the last templates.
async function context(tx: TransactionSql, id: string): Promise<PendingPost> {
  const [row] = await tx<ContextRow[]>`
    select p.id, p.match_id, p.side, p.kind, p.attempts, p.text, p.template_id,
      m.season, m.home_team_id, m.away_team_id,
      h.name as home_name, a.name as away_name,
      d.home_score, d.away_score, d.minute, d.added_minute
    from social_posts p
    join matches m on m.id = p.match_id
    join teams h on h.id = m.home_team_id
    join teams a on a.id = m.away_team_id
    join decisions d on d.id = p.decision_id
    where p.id = ${id}`;
  const teamId = row.side === "home" ? row.home_team_id : row.away_team_id;
  const [lastGoal] = await tx<{ status: PostStatus; reason: string | null }[]>`
    select status, reason from social_posts
    where match_id = ${row.match_id} and side = ${row.side}
      and kind = 'goal' and id <> ${id}
    order by created_at desc, id desc limit 1`;
  const [lastOfTeam] = await tx<{ template_id: string }[]>`
    select p.template_id from social_posts p
    join matches m on m.id = p.match_id
    where p.id <> ${id} and p.template_id is not null and p.kind = ${row.kind}
      and (case p.side when 'home' then m.home_team_id else m.away_team_id end) = ${teamId}
    order by p.created_at desc, p.id desc limit 1`;
  const [lastOfAccount] = await tx<{ template_id: string }[]>`
    select template_id from social_posts
    where id <> ${id} and template_id is not null
    order by created_at desc, id desc limit 1`;
  return {
    id: row.id,
    matchId: row.match_id,
    side: row.side,
    kind: row.kind,
    attempts: row.attempts,
    text: row.text,
    templateId: row.template_id,
    season: row.season,
    home: { id: row.home_team_id, name: row.home_name },
    away: { id: row.away_team_id, name: row.away_name },
    score: { home: row.home_score ?? 0, away: row.away_score ?? 0 },
    minute: row.minute,
    addedMinute: row.added_minute,
    lastGoal:
      lastGoal === undefined
        ? null
        : { status: lastGoal.status, reason: lastGoal.reason },
    lastTemplateOfTeam: lastOfTeam?.template_id ?? null,
    lastTemplateOfAccount: lastOfAccount?.template_id ?? null,
  };
}

export type { ClaimOutcome, FinishResult, PendingPost, SocialDb };

import type { Sql } from "postgres";
import type { Instant, MatchStatus, Qualifier } from "../model/index.ts";
import type { PostKind, PostStatus, Side } from "./port.ts";
import type {
  ReportDecision,
  ReportMatch,
  ReportPost,
  ReportWindow,
} from "./report.ts";

// SPEC-079 CA-2: the reads of the report, in one `read only` transaction.
// The matches of the window (kickoff in [from, to)), with the names of both
// teams and the season; every Decision of those matches by version, whatever
// its decided_at (the first live one needs its predecessor, which may have
// been decided days before); and their social_posts. Nothing here writes.
// Every instant becomes an Instant: no Date leaves this layer (D-9).

const instant = (value: Date): Instant => value.toISOString();

export type ReportRows = {
  matches: ReportMatch[];
  decisions: ReportDecision[];
  posts: ReportPost[];
};

export function reportRows(
  sql: Sql,
  window: ReportWindow,
): Promise<ReportRows> {
  return sql.begin("read only", async (tx) => {
    const matches = await tx<
      {
        id: string;
        season: string;
        kickoff: Date;
        home_team_id: string;
        home_name: string;
        away_team_id: string;
        away_name: string;
      }[]
    >`select m.id, m.season, m.kickoff,
        m.home_team_id, h.name as home_name, m.away_team_id, a.name as away_name
      from matches m
      join teams h on h.id = m.home_team_id
      join teams a on a.id = m.away_team_id
      where m.kickoff >= ${window.from} and m.kickoff < ${window.to}
      order by m.kickoff, m.id`;
    const ids = matches.map((m) => m.id);
    if (ids.length === 0) return { matches: [], decisions: [], posts: [] };

    const decisions = await tx<
      {
        id: string;
        match_id: string;
        version: number;
        status: MatchStatus;
        home_score: number | null;
        away_score: number | null;
        qualifier: Qualifier;
        decided_at: Date;
      }[]
    >`select id, match_id, version, status, home_score, away_score, qualifier, decided_at
      from decisions where match_id = any (${tx.array(ids)})
      order by match_id, version`;

    const posts = await tx<
      {
        id: string;
        decision_id: string;
        match_id: string;
        side: Side;
        kind: PostKind;
        status: PostStatus;
        attempts: number;
        reason: string | null;
        template_id: string | null;
        text: string | null;
        provider: string | null;
        provider_post_id: string | null;
        created_at: Date;
        closed_at: Date | null;
      }[]
    >`select id, decision_id, match_id, side, kind, status, attempts, reason,
        template_id, text, provider, provider_post_id, created_at, closed_at
      from social_posts where match_id = any (${tx.array(ids)})
      order by created_at, id`;

    return {
      matches: matches.map((m) => ({
        id: m.id,
        season: m.season,
        kickoff: instant(m.kickoff),
        home: { id: m.home_team_id, name: m.home_name },
        away: { id: m.away_team_id, name: m.away_name },
      })),
      decisions: decisions.map((d) => ({
        id: d.id,
        matchId: d.match_id,
        version: d.version,
        status: d.status,
        score:
          d.home_score === null || d.away_score === null
            ? null
            : { home: d.home_score, away: d.away_score },
        qualifier: d.qualifier,
        decidedAt: instant(d.decided_at),
      })),
      posts: posts.map((p) => ({
        id: p.id,
        decisionId: p.decision_id,
        matchId: p.match_id,
        side: p.side,
        kind: p.kind,
        status: p.status,
        attempts: p.attempts,
        reason: p.reason,
        templateId: p.template_id,
        text: p.text,
        provider: p.provider,
        providerPostId: p.provider_post_id,
        createdAt: instant(p.created_at),
        closedAt: p.closed_at === null ? null : instant(p.closed_at),
      })),
    };
  });
}

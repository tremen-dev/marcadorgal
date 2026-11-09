import type { TransactionSql } from "postgres";
import type { GoalEvent } from "./goal-events.ts";
import { errorMessage } from "./purge.ts";

// SPEC-066 CA-3 (ADR-030 §2): the outbox row of each goal event, written in
// the transaction of the Decision and inside a savepoint. If the row fails
// (the table is gone, a constraint), the Decision is written all the same
// and the error is one line of log: the publication never governs the
// score (D-9). The unique (decision_id, side) and the lock of ADR-019 make a
// second engine over the same goal a no-op; "on conflict do nothing" is the
// belt to that pair of braces.
export async function queueSocialPosts(
  sql: TransactionSql,
  decisionId: string,
  matchId: string,
  events: readonly GoalEvent[],
): Promise<number> {
  if (events.length === 0) return 0;
  try {
    return await sql.savepoint(async (s) => {
      let queued = 0;
      for (const event of events) {
        const rows = await s`insert into social_posts
            (decision_id, match_id, side, kind)
          values (${decisionId}, ${matchId}, ${event.side}, ${event.kind})
          on conflict (decision_id, side) do nothing
          returning id`;
        queued += rows.length;
      }
      return queued;
    });
  } catch (e) {
    console.error(
      `social_posts: no se pudo encolar ${events.length} evento(s) de ${matchId} (decision ${decisionId}): ${oneLine(errorMessage(e))}`,
    );
    return 0;
  }
}

const oneLine = (text: string): string => text.replace(/\s+/g, " ").trim();

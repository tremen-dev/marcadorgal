import { type Locale, t } from "@/i18n";
import type { Instant, PublicGoal } from "@/model";
import { isRecent, pulseIterations } from "@/xornada/recent-goal";
import styles from "./TeamGoals.module.css";

// SPEC-068: the scorers of one side, hung from their team. The position
// attributes the goal, so the block carries no team name, icon nor rule.
// Shared by MatchRow (folded, SPEC-056) and DirectosView (always open).

export type TeamSide = "home" | "away";

type Props = {
  team: TeamSide;
  goals: readonly PublicGoal[];
  locale: Locale;
  // `goals-{matchId}-{home|away}`, the target of the row's aria-controls.
  id?: string;
  // Folded block (MatchRow): served closed, toggled by the row. Undefined
  // means always visible, without interaction (DirectosView).
  expanded?: boolean;
  // CA-4 (SPEC-041, SPEC-056 CA-3): the side scored a little while ago. The
  // instant its mark ends and the clock to read it with (the render's, then
  // the browser's); the pill pulses once per second left.
  recent?: { until: Instant; now: number } | null;
};

const cx = (...names: (string | false | undefined)[]): string =>
  names.filter(Boolean).join(" ");

// CA-2: by minute ascending; on a tie, arrival order (Array.sort is stable).
export const sortGoals = (goals: readonly PublicGoal[]): PublicGoal[] =>
  [...goals].sort((a, b) => a.minute - b.minute);

// CA-3: the note after the name, a grey annotation and never a state.
function kindKey(goal: PublicGoal) {
  if (goal.penalty) return "xornada.goalPenalty" as const;
  if (goal.ownGoal) return "xornada.goalOwnGoal" as const;
  return null;
}

export function TeamGoals({
  team,
  goals,
  locale,
  id,
  expanded,
  recent = null,
}: Props) {
  const own = sortGoals(goals.filter((g) => g.team === team));
  if (own.length === 0) return null;
  const folded = expanded !== undefined;
  // CA-4: only the last line by minute of a side that just scored.
  const marked =
    recent !== null && isRecent(recent.until, recent.now) ? recent : null;
  return (
    <div
      id={id}
      className={cx(
        styles.block,
        folded && styles.folded,
        folded && expanded && styles.expanded,
      )}
      data-testid="team-goals"
      data-team={team}
      data-expanded={folded ? (expanded ? "true" : "false") : undefined}
    >
      <div className={styles.clip}>
        <div className={styles.list}>
          {own.map((g, idx) => {
            const kind = kindKey(g);
            const isLast = idx === own.length - 1;
            const scorer = isLast ? marked : null;
            return (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: goals have no id
                key={`${g.minute}-${g.player}-${idx}`}
                className={styles.line}
                data-testid="goal-line"
                data-team={team}
                data-recent={scorer !== null ? "true" : "false"}
              >
                <span className={styles.minute} data-testid="goal-minute">
                  {g.minute}&apos;
                </span>
                <span className={styles.player} data-testid="goal-player">
                  {g.player}
                </span>
                {kind !== null && (
                  <span className={styles.kind} data-testid="goal-kind">
                    {t(locale, kind)}
                  </span>
                )}
                {scorer !== null && (
                  <span
                    className={styles.badge}
                    style={{
                      animationIterationCount: pulseIterations(
                        scorer.until,
                        scorer.now,
                      ),
                    }}
                    data-testid="recent-scorer-badge"
                  >
                    {t(locale, "xornada.recentGoalLabel")}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

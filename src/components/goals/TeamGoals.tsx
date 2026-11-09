import { type Locale, t } from "@/i18n";
import type { PublicGoal } from "@/model";
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

export function TeamGoals({ team, goals, locale, id, expanded }: Props) {
  const own = sortGoals(goals.filter((g) => g.team === team));
  if (own.length === 0) return null;
  const folded = expanded !== undefined;
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
        <ul className={styles.list}>
          {own.map((g, idx) => {
            const kind = kindKey(g);
            return (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: goals have no id
                key={`${g.minute}-${g.player}-${idx}`}
                className={styles.line}
                data-testid="goal-line"
                data-team={team}
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
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

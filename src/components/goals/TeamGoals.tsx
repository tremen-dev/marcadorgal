import type { PublicGoal } from "@/model";
import styles from "./TeamGoals.module.css";

// SPEC-068: the scorers of one side, hung from their team. The position
// attributes the goal, so the block carries no team name, icon nor rule.
// Shared by MatchRow (folded, SPEC-056) and DirectosView (always open).

export type TeamSide = "home" | "away";

type Props = {
  team: TeamSide;
  goals: readonly PublicGoal[];
  // `goals-{matchId}-{home|away}`, the target of the row's aria-controls.
  id?: string;
  // Folded block (MatchRow): served closed, toggled by the row. Undefined
  // means always visible, without interaction (DirectosView).
  expanded?: boolean;
};

const cx = (...names: (string | false | undefined)[]): string =>
  names.filter(Boolean).join(" ");

export function TeamGoals({ team, goals, id, expanded }: Props) {
  const own = goals.filter((g) => g.team === team);
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
          {own.map((g, idx) => (
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
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

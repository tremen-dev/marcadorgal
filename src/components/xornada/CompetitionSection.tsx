import { type Locale, t } from "@/i18n";
import type { XornadaCompetition } from "@/xornada/view";
import { CountLabel } from "./CountLabel";
import { liveCountTemplates } from "./labels";
import { MatchRow } from "./MatchRow";
import styles from "./Xornada.module.css";

type Props = {
  competition: XornadaCompetition;
  locale: Locale;
  // SPEC-024 CA-9: matchId → minutes since its last observation.
  ages?: ReadonlyMap<string, number>;
};

export const sectionId = (competitionId: string): string =>
  `xornada-${competitionId}`;
export const detailsId = (competitionId: string): string =>
  `rows-${competitionId}`;

// SPEC-023 CA-5: each competition folds with <details>, without JavaScript.
// The fold lives in the DOM only: never in the URL, never remembered (N-2).
export function CompetitionSection({ competition, locale, ages }: Props) {
  const { competitionId } = competition;
  const headingId = `competition-${competitionId}`;
  return (
    <section
      id={sectionId(competitionId)}
      className={styles.competition}
      aria-labelledby={headingId}
      data-testid="competition"
      data-competition={competitionId}
    >
      <details
        id={detailsId(competitionId)}
        className={styles.details}
        open
        data-testid="competition-details"
      >
        <summary className={styles.head} data-testid="competition-head">
          <h2
            id={headingId}
            className={styles.competitionName}
            data-testid="competition-name"
          >
            {competition.name}
          </h2>
          <span className={styles.round} data-testid="competition-round">
            {t(locale, "xornada.round", { n: competition.round })}
          </span>
          <span className={styles.spacer} />
          {/* F-4: the client keeps it in step with the day and the filter
              (hidden when none of the rows left is live). Filtering only
              lowers the count, so it is served only with live matches. */}
          {competition.liveCount > 0 && (
            <span
              className={styles.livePill}
              data-competition-count={competitionId}
              data-show="live"
              data-testid="live-pill"
            >
              <span aria-hidden="true" data-n>
                {competition.liveCount}
              </span>
              <span className={styles.srOnly}>
                <CountLabel
                  templates={liveCountTemplates(locale)}
                  n={competition.liveCount}
                />
              </span>
            </span>
          )}
          <span className={styles.arrow} aria-hidden="true">
            <span className={styles.arrowOpen}>▾</span>
            <span className={styles.arrowClosed}>▸</span>
          </span>
        </summary>
        <ul className={styles.rows}>
          {competition.rows.map((row) => (
            <MatchRow
              key={row.matchId}
              row={row}
              locale={locale}
              age={ages?.get(row.matchId) ?? null}
            />
          ))}
        </ul>
      </details>
    </section>
  );
}

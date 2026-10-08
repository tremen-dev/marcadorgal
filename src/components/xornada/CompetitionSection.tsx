import { type Locale, t } from "@/i18n";
import type { XornadaCompetition } from "@/xornada/view";
import { MatchRow } from "./MatchRow";
import styles from "./Xornada.module.css";

type Props = { competition: XornadaCompetition; locale: Locale };

export const sectionId = (competitionId: string): string =>
  `xornada-${competitionId}`;
export const detailsId = (competitionId: string): string =>
  `rows-${competitionId}`;

// SPEC-023 CA-5: each competition folds with <details>, without JavaScript.
// The fold lives in the DOM only: never in the URL, never remembered (N-2).
export function CompetitionSection({ competition, locale }: Props) {
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
          {competition.liveCount > 0 && (
            <span className={styles.livePill} data-testid="live-pill">
              <span aria-hidden="true">{competition.liveCount}</span>
              <span className={styles.srOnly}>
                {t(locale, "xornada.liveCount", { n: competition.liveCount })}
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
            <MatchRow key={row.matchId} row={row} locale={locale} />
          ))}
        </ul>
      </details>
    </section>
  );
}

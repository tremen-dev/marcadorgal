import { type Locale, t } from "@/i18n";
import type { XornadaCompetition, XornadaDay } from "@/xornada/view";
import { CountLabel } from "./CountLabel";
import { dayHeaderLabel, liveCountTemplates } from "./labels";
import { MatchRow } from "./MatchRow";
import styles from "./Xornada.module.css";

type Props = {
  competition: XornadaCompetition;
  locale: Locale;
  // SPEC-024 CA-9: matchId → minutes since its last observation.
  ages?: ReadonlyMap<string, number>;
  // SPEC-033 CA-2: the days of the xornada, to know which one is today.
  days?: readonly XornadaDay[];
};

export const sectionId = (competitionId: string): string =>
  `xornada-${competitionId}`;
export const detailsId = (competitionId: string): string =>
  `rows-${competitionId}`;

// SPEC-023 CA-5: each competition folds with <details>, without JavaScript.
// The fold lives in the DOM only: never in the URL, never remembered (N-2).
export function CompetitionSection({
  competition,
  locale,
  ages,
  days = [],
}: Props) {
  const { competitionId } = competition;
  const today = days.find((d) => d.today)?.date ?? null;
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
        {/* SPEC-033 CA-2: each day of the competition under its header, an
            <h3> below the competition's <h2>. The client hides the headers
            with a day chosen, and a group left empty by a filter (CA-3). */}
        {competition.dayGroups.map((group) => (
          <div
            key={group.date}
            className={styles.dayGroup}
            data-day-group={group.date}
            data-testid="day-group"
          >
            <h3
              className={styles.dayHeader}
              data-day-header
              data-testid="day-header"
            >
              {dayHeaderLabel(group, group.date === today, locale)}
            </h3>
            <ul className={styles.rows}>
              {group.rows.map((row) => (
                <MatchRow
                  key={row.matchId}
                  row={row}
                  locale={locale}
                  age={ages?.get(row.matchId) ?? null}
                />
              ))}
            </ul>
          </div>
        ))}
      </details>
    </section>
  );
}

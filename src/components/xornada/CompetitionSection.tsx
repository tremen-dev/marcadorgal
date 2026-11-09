import { Fragment } from "react";
import { SHOW_TABLE_LINK } from "@/app/config";
import { type Locale, t } from "@/i18n";
import type { XornadaCompetition, XornadaDay } from "@/xornada/view";
import { CountLabel } from "./CountLabel";
import { competitionNameSegments } from "./competition-name";
import { liveCountTemplates, matchCountTemplates } from "./labels";
import { MatchRow, type RecentGoalView } from "./MatchRow";
import styles from "./Xornada.module.css";

type Props = {
  competition: XornadaCompetition;
  locale: Locale;
  // SPEC-024 CA-9: matchId → minutes since its last observation.
  ages?: ReadonlyMap<string, number>;
  // SPEC-040 CA-2: the days of the xornada, to know which one is today.
  days?: readonly XornadaDay[];
  // SPEC-041 CA-4: the render's instant and the web's window and variant.
  recentGoal?: RecentGoalView;
  // Whether to link to the competition's table (SHOW_TABLE_LINK).
  showTableLink?: boolean;
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
  recentGoal,
  showTableLink = SHOW_TABLE_LINK,
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
            {/* SPEC-045 CA-3: breaks only before « · »; each segment, the
                last «· Grupo 1» included, is one piece. The text stays the
                canonical name (D-2). */}
            {competitionNameSegments(competition.name).map((segment, i) => (
              <Fragment key={segment}>
                {i > 0 && " "}
                <span
                  className={styles.nameSegment}
                  data-testid="competition-name-segment"
                >
                  {segment}
                </span>
              </Fragment>
            ))}
          </h2>
          <span className={styles.round} data-testid="competition-round">
            {t(locale, "xornada.round", { n: competition.round })}
          </span>
          <span className={styles.spacer} />
          {/* F-4: the client keeps both in step with the day and the
              filter: the live count while a row left is live, else the
              total. Filtering only lowers the live count, so it is served
              only with live matches. SPEC-040 CA-4: the sidebar's count, in
              words on desktop (V-1); mobile keeps today's bare pill. */}
          {competition.liveCount > 0 && (
            <span
              className={styles.livePill}
              data-competition-count={competitionId}
              data-show="live"
              data-testid="live-pill"
            >
              <span className={styles.pillNumber} aria-hidden="true" data-n>
                {competition.liveCount}
              </span>
              <span className={styles.pillWords}>
                <CountLabel
                  templates={liveCountTemplates(locale)}
                  n={competition.liveCount}
                />
              </span>
            </span>
          )}
          <span
            className={styles.headTotal}
            hidden={competition.liveCount > 0}
            data-competition-count={competitionId}
            data-show="matching"
            data-testid="competition-total"
          >
            <CountLabel
              templates={matchCountTemplates(locale)}
              n={competition.rows.length}
            />
          </span>
          <span className={styles.arrow} aria-hidden="true">
            <span className={styles.arrowOpen}>▾</span>
            <span className={styles.arrowClosed}>▸</span>
          </span>
        </summary>
        {showTableLink && (
          <div className={styles.competitionSubhead}>
            <a
              href={
                locale === "es"
                  ? `/es/competicion/${competitionId}`
                  : `/competicion/${competitionId}`
              }
              className={styles.tableLink}
              data-testid="competition-table-link"
              aria-label={`${t(locale, "competitions.tableLink")} - ${competition.name}`}
            >
              <span>{t(locale, "competitions.tableLink")}</span>
              <span className={styles.tableLinkArrow} aria-hidden="true">
                ↗
              </span>
            </a>
          </div>
        )}
        {/* SPEC-040 CA-2 (replaces SPEC-033 CA-2): one list, no day
            headers; every row says its own date. */}
        <ul className={styles.rows}>
          {competition.rows.map((row) => (
            <MatchRow
              key={row.matchId}
              row={row}
              locale={locale}
              age={ages?.get(row.matchId) ?? null}
              today={row.day === today}
              recentGoal={recentGoal}
            />
          ))}
        </ul>
      </details>
    </section>
  );
}

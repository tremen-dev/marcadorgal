import { type Locale, t } from "@/i18n";
import type { XornadaCompetition } from "@/xornada/view";
import { detailsId, sectionId } from "./CompetitionSection";
import { CountLabel } from "./CountLabel";
import { liveCountTemplates, matchCountTemplates } from "./labels";
import styles from "./Xornada.module.css";

type Props = { competitions: readonly XornadaCompetition[]; locale: Locale };

// SPEC-023 CA-7 (H-6): the desktop sidebar, one entry per competition. With
// JavaScript an entry folds its competition; without it, it links to it.
export function CompetitionNav({ competitions, locale }: Props) {
  return (
    <nav
      className={styles.sidebar}
      aria-labelledby="competitions-title"
      data-testid="sidebar"
    >
      <h2 id="competitions-title" className={styles.sidebarTitle}>
        {t(locale, "xornada.competitions")}
      </h2>
      <ul className={styles.navList}>
        {competitions.map((c) => {
          const live = c.liveCount > 0;
          return (
            <li key={c.competitionId}>
              <a
                className={styles.navEntry}
                href={`#${sectionId(c.competitionId)}`}
                aria-controls={detailsId(c.competitionId)}
                aria-expanded="true"
                data-competition-toggle={c.competitionId}
                data-testid="sidebar-entry"
              >
                <span className={styles.navName} data-testid="sidebar-name">
                  {c.name}
                </span>
                {/* V-1: the live count says so on screen; the total is a
                    bare number with its words for screen readers. F-4: the
                    client keeps both in step with the day and the filter. */}
                {live && (
                  <span
                    className={styles.navLive}
                    data-competition-count={c.competitionId}
                    data-show="live"
                    data-testid="sidebar-live"
                  >
                    <CountLabel
                      templates={liveCountTemplates(locale)}
                      n={c.liveCount}
                    />
                  </span>
                )}
                <span
                  className={styles.navCount}
                  hidden={live}
                  data-competition-count={c.competitionId}
                  data-show="matching"
                  data-testid="sidebar-total"
                >
                  <span aria-hidden="true" data-n>
                    {c.rows.length}
                  </span>
                  <span className={styles.srOnly}>
                    <CountLabel
                      templates={matchCountTemplates(locale)}
                      n={c.rows.length}
                    />
                  </span>
                </span>
                <span className={styles.arrow} aria-hidden="true">
                  <span className={styles.arrowOpen}>▾</span>
                  <span className={styles.arrowClosed}>▸</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

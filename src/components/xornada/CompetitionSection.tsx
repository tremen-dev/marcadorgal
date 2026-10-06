import { type Locale, t } from "@/i18n";
import type { XornadaCompetition } from "@/xornada/view";
import { MatchRow } from "./MatchRow";
import styles from "./Xornada.module.css";

type Props = { competition: XornadaCompetition; locale: Locale };

export function CompetitionSection({ competition, locale }: Props) {
  const headingId = `competition-${competition.competitionId}`;
  return (
    <section
      className={styles.competition}
      aria-labelledby={headingId}
      data-testid="competition"
    >
      <div className={styles.head}>
        <h2
          id={headingId}
          className={styles.competitionName}
          data-testid="competition-name"
        >
          {competition.name}
        </h2>
        {competition.liveCount > 0 && (
          <span className={styles.livePill} data-testid="live-pill">
            <span aria-hidden="true">{competition.liveCount}</span>
            <span className={styles.srOnly}>
              {t(locale, "xornada.liveCount", { n: competition.liveCount })}
            </span>
          </span>
        )}
      </div>
      <ul className={styles.rows}>
        {competition.rows.map((row) => (
          <MatchRow key={row.matchId} row={row} locale={locale} />
        ))}
      </ul>
    </section>
  );
}

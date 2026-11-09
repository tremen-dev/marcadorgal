import { type Locale, t } from "../../i18n/index.ts";
import type { OfficialCalendarResponse } from "../../lib/explorer-client.ts";
import { getGalicianClub, isGalicianClub } from "../../model/index.ts";
import styles from "./CalendarView.module.css";

type Props = {
  calendarData: OfficialCalendarResponse;
  locale: Locale;
};

export function CalendarView({ calendarData, locale }: Props) {
  const matches = calendarData.matches || [];

  // Group matches by round
  const byRound = new Map<number, typeof matches>();
  for (const match of matches) {
    const list = byRound.get(match.round) ?? [];
    list.push(match);
    byRound.set(match.round, list);
  }

  const rounds = [...byRound.entries()].sort(([a], [b]) => a - b);

  return (
    <div className={styles.container} data-testid="calendar-view">
      {rounds.map(([round, roundMatches]) => (
        <section key={round} className={styles.roundSection}>
          <div className={styles.roundHeader}>
            <span className={styles.roundTitle}>
              {t(locale, "xornada.round", { n: round })}
            </span>
            <span className={styles.roundCount}>
              {t(locale, "xornada.matchCount", { n: roundMatches.length })}
            </span>
          </div>

          <div className={styles.matchesList}>
            {roundMatches.map((m) => {
              const homeClub = getGalicianClub(m.home);
              const awayClub = getGalicianClub(m.away);

              const isGalician =
                isGalicianClub(m.home) ||
                isGalicianClub(m.away) ||
                m.home.toLowerCase().includes("deportivo abanca") ||
                m.away.toLowerCase().includes("deportivo abanca") ||
                m.home.toLowerCase().includes("as celtas") ||
                m.away.toLowerCase().includes("as celtas");

              const homeName = homeClub?.name || m.home;
              const awayName = awayClub?.name || m.away;

              const date = new Date(m.kickoff);
              const formattedDate = !Number.isNaN(date.getTime())
                ? date.toLocaleDateString(locale === "gl" ? "gl-ES" : "es-ES", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : m.kickoff;

              return (
                <div
                  key={m.externalId}
                  className={`${styles.matchCard} ${
                    isGalician ? styles.matchCardGalician : ""
                  }`}
                  data-match-id={m.externalId}
                >
                  <div className={styles.matchTeams}>
                    <div className={styles.teamRow}>
                      {homeClub?.shield && (
                        // biome-ignore lint/performance/noImgElement: local SVG shield
                        <img
                          src={homeClub.shield}
                          className={styles.shield}
                          alt=""
                          aria-hidden="true"
                        />
                      )}
                      <span
                        className={`${styles.teamName} ${
                          homeClub ? styles.galicianName : ""
                        }`}
                      >
                        {homeName}
                      </span>
                    </div>

                    <div className={styles.teamRow}>
                      {awayClub?.shield && (
                        // biome-ignore lint/performance/noImgElement: local SVG shield
                        <img
                          src={awayClub.shield}
                          className={styles.shield}
                          alt=""
                          aria-hidden="true"
                        />
                      )}
                      <span
                        className={`${styles.teamName} ${
                          awayClub ? styles.galicianName : ""
                        }`}
                      >
                        {awayName}
                      </span>
                    </div>
                  </div>

                  <div className={styles.matchInfo}>
                    <span className={styles.kickoffTime}>{formattedDate}</span>
                    {m.timeConfirmed ? (
                      <span className={styles.confirmedBadge}>
                        {t(locale, "competitions.confirmedTime")}
                      </span>
                    ) : (
                      <span className={styles.tbdBadge}>
                        {t(locale, "competitions.tbdTime")}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

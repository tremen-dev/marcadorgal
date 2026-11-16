import { formatDay, formatTime, type Locale, t } from "../../i18n/index.ts";
import type { Instant } from "../../model/index.ts";
import { getGalicianClub, isGalicianClub } from "../../model/index.ts";
import styles from "./CalendarView.module.css";

// One match of the calendar view. timeConfirmed is what explorer says; the
// local calendar does not know it, so it carries none and shows no badge
// (SPEC-089 CA-3). An OfficialCalendarResponse fits as it is.
export type CalendarViewMatch = {
  externalId: string;
  round: number;
  kickoff: string;
  home: string;
  away: string;
  timeConfirmed?: boolean;
};

export type CalendarViewData = { matches: readonly CalendarViewMatch[] };

type Props = {
  calendarData: CalendarViewData;
  locale: Locale;
};

// Day and hour in Europe/Madrid whatever the process clock (SPEC-089 CA-3).
function formatKickoff(kickoff: string, locale: Locale): string {
  if (Number.isNaN(new Date(kickoff).getTime())) return kickoff;
  const instant = kickoff as Instant;
  return `${formatDay(instant, locale)} · ${formatTime(instant, locale)}`;
}

export function CalendarView({ calendarData, locale }: Props) {
  const matches = calendarData.matches || [];

  // Group matches by round
  const byRound = new Map<number, CalendarViewMatch[]>();
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

              const formattedDate = formatKickoff(m.kickoff, locale);

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
                    {m.timeConfirmed === true && (
                      <span className={styles.confirmedBadge}>
                        {t(locale, "competitions.confirmedTime")}
                      </span>
                    )}
                    {m.timeConfirmed === false && (
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

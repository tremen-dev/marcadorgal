import {
  formatDay,
  formatMonth,
  formatTime,
  type Locale,
  t,
} from "../../i18n/index.ts";
import { kickoffPrecision } from "../../lib/kickoff-precision.ts";
import type { Instant } from "../../model/index.ts";
import { getGalicianClub, isGalicianClub } from "../../model/index.ts";
import styles from "./CalendarView.module.css";

// One match of the calendar view. timeConfirmed is what explorer says; the
// local calendar does not know it, so it carries none and shows no badge
// (SPEC-089 CA-3). An OfficialCalendarResponse fits as it is: explorer gives
// ids in home/away. The local calendar gives the visible name in home/away
// and the team id of the file in homeId/awayId (SPEC-089 F-V-1).
export type CalendarViewMatch = {
  externalId: string;
  round: number;
  kickoff: string;
  home: string;
  away: string;
  homeId?: string;
  awayId?: string;
  timeConfirmed?: boolean;
  // SPEC-091 CA-3: explorer's; absent means true.
  dateConfirmed?: boolean;
};

export type CalendarViewData = { matches: readonly CalendarViewMatch[] };

type Props = {
  calendarData: CalendarViewData;
  locale: Locale;
};

// Day, month and hour in Europe/Madrid whatever the process clock (SPEC-089
// CA-3). SPEC-091 CA-7: without the hour when only the day is known.
function formatKickoff(
  kickoff: string,
  locale: Locale,
  withTime: boolean,
): string {
  if (Number.isNaN(new Date(kickoff).getTime())) return kickoff;
  const instant = kickoff as Instant;
  const date = `${formatDay(instant, locale)} ${formatMonth(instant, locale)}`;
  return withTime ? `${date} · ${formatTime(instant, locale)}` : date;
}

// Inside a round: by kickoff, then by key in code order (not locale); an
// unparsable kickoff goes last with the same tie-break (SPEC-089 CA-8). The
// key is externalId: matchId for the local calendar, explorer's id otherwise.
function compareMatches(a: CalendarViewMatch, b: CalendarViewMatch): number {
  const ta = Date.parse(a.kickoff);
  const tb = Date.parse(b.kickoff);
  const aBad = Number.isNaN(ta);
  const bBad = Number.isNaN(tb);
  if (aBad !== bBad) return aBad ? 1 : -1;
  if (!aBad && ta !== tb) return ta - tb;
  if (a.externalId === b.externalId) return 0;
  return a.externalId < b.externalId ? -1 : 1;
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

  const rounds = [...byRound.entries()]
    .sort(([a], [b]) => a - b)
    .map(([round, list]) => [round, [...list].sort(compareMatches)] as const);

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
              const homeKey = m.homeId ?? m.home;
              const awayKey = m.awayId ?? m.away;
              const homeClub = getGalicianClub(homeKey);
              const awayClub = getGalicianClub(awayKey);

              const isGalician =
                isGalicianClub(homeKey) ||
                isGalicianClub(awayKey) ||
                m.home.toLowerCase().includes("deportivo abanca") ||
                m.away.toLowerCase().includes("deportivo abanca") ||
                m.home.toLowerCase().includes("as celtas") ||
                m.away.toLowerCase().includes("as celtas");

              const homeName =
                m.homeId === undefined ? homeClub?.name || m.home : m.home;
              const awayName =
                m.awayId === undefined ? awayClub?.name || m.away : m.away;

              // SPEC-091 CA-7: the local calendar says no precision (exact,
              // no badge); explorer's, by its two flags.
              const precision =
                m.timeConfirmed === undefined
                  ? "exact"
                  : kickoffPrecision({
                      timeConfirmed: m.timeConfirmed,
                      dateConfirmed: m.dateConfirmed,
                    });

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
                    {precision === "round" ? (
                      // The round is already the header of the section.
                      <span className={styles.tbdBadge}>
                        {t(locale, "competitions.dateTbd")}
                      </span>
                    ) : (
                      <>
                        <span className={styles.kickoffTime}>
                          {formatKickoff(
                            m.kickoff,
                            locale,
                            precision === "exact",
                          )}
                        </span>
                        {m.timeConfirmed === true && precision === "exact" && (
                          <span className={styles.confirmedBadge}>
                            {t(locale, "competitions.confirmedTime")}
                          </span>
                        )}
                        {precision === "date" && (
                          <span className={styles.tbdBadge}>
                            {t(locale, "competitions.tbdTime")}
                          </span>
                        )}
                      </>
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

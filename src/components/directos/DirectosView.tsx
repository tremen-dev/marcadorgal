import { leagueColor } from "../../design/league-color.ts";
import { type Locale, t } from "../../i18n/index.ts";
import type { GroupedCompetitionMatches } from "../../lib/explorer-matches.ts";
import { TeamGoals } from "../goals/TeamGoals.tsx";
import { CompetitionNav } from "../navigation/CompetitionNav.tsx";
import styles from "./DirectosView.module.css";

type Props = {
  date: string;
  groupedCompetitions: GroupedCompetitionMatches[];
  locale: Locale;
};

export function DirectosView({ date, groupedCompetitions, locale }: Props) {
  const totalLive = groupedCompetitions.reduce(
    (acc, g) => acc + g.liveCount,
    0,
  );

  if (groupedCompetitions.length === 0) {
    return (
      <div className={styles.container} data-testid="directos-view">
        <CompetitionNav locale={locale} />
        <div className={styles.dateBar}>
          <span className={styles.dateText}>{date}</span>
        </div>
        <p className={styles.emptyState}>
          {t(locale, "competitions.noMatches")}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container} data-testid="directos-view">
      <CompetitionNav locale={locale} />
      <div className={styles.dateBar}>
        <span className={styles.dateText}>{date}</span>
        {totalLive > 0 && (
          <span
            className={styles.liveCountBadge}
            data-testid="total-live-badge"
          >
            {t(locale, "xornada.liveCount", { n: totalLive })}
          </span>
        )}
      </div>

      {groupedCompetitions.map((comp) => (
        <section
          key={comp.competitionId}
          className={styles.competitionSection}
          data-competition={comp.competitionId}
          data-category={comp.category}
        >
          <div className={styles.compHeader}>
            <span
              className={styles.compDot}
              style={{
                backgroundColor:
                  leagueColor(comp.competitionId) ?? "var(--marca)",
              }}
              aria-hidden="true"
            />
            <span className={styles.compName}>{comp.competitionName}</span>
            <span className={styles.compCategory}>
              {comp.category === "femenino"
                ? t(locale, "competitions.women")
                : t(locale, "competitions.men")}
            </span>
          </div>

          <div className={styles.matchesList}>
            {comp.matches.map((m) => {
              const isLive = m.status === "live";

              const marginLabel = (() => {
                if (isLive) {
                  if (m.halfTime) return t(locale, "xornada.halfTime");
                  if (m.minute !== null) {
                    return m.addedMinute !== null
                      ? `${m.minute}+${m.addedMinute}'`
                      : `${m.minute}'`;
                  }
                  return t(locale, "status.live");
                }
                if (m.status === "finished")
                  return t(locale, "status.finished");
                if (m.status === "postponed")
                  return t(locale, "status.postponed");
                if (m.status === "suspended")
                  return t(locale, "status.suspended");
                return t(locale, "status.scheduled");
              })();

              return (
                <div
                  key={m.id}
                  className={`${styles.matchCard} ${isLive ? styles.matchCardLive : ""}`}
                  data-match-id={m.id}
                  data-status={m.status}
                >
                  <div className={styles.matchMain}>
                    <div className={styles.marginBox}>
                      {isLive ? (
                        <span className={styles.statusLive}>
                          {!m.halfTime && (
                            <span
                              className={styles.liveDot}
                              aria-hidden="true"
                            />
                          )}
                          {marginLabel}
                        </span>
                      ) : (
                        <span
                          className={
                            m.status === "finished"
                              ? styles.statusFinished
                              : styles.statusScheduled
                          }
                        >
                          {marginLabel}
                        </span>
                      )}
                      {isLive && m.halfTime && (
                        <span className={styles.halfTimeText}>
                          {t(locale, "xornada.halfTime")}
                        </span>
                      )}
                    </div>

                    <div className={styles.teamsBox}>
                      <div className={styles.teamLine}>
                        <div className={styles.teamNameWrap}>
                          {m.homeShield && (
                            // biome-ignore lint/performance/noImgElement: local SVG shield
                            <img
                              src={m.homeShield}
                              className={styles.shield}
                              alt=""
                              aria-hidden="true"
                            />
                          )}
                          <span
                            className={`${styles.teamName} ${
                              m.homeGalician ? styles.galicianName : ""
                            }`}
                          >
                            {m.homeTeam}
                          </span>
                        </div>
                        <span className={styles.teamScore}>
                          {m.homeScore !== null ? m.homeScore : "–"}
                        </span>
                      </div>
                      {/* SPEC-068 CA-7: each side's scorers under its line,
                          always open, by the component MatchRow uses. */}
                      <TeamGoals
                        team="home"
                        goals={m.goals}
                        locale={locale}
                        id={`goals-${m.id}-home`}
                      />

                      <div className={styles.teamLine}>
                        <div className={styles.teamNameWrap}>
                          {m.awayShield && (
                            // biome-ignore lint/performance/noImgElement: local SVG shield
                            <img
                              src={m.awayShield}
                              className={styles.shield}
                              alt=""
                              aria-hidden="true"
                            />
                          )}
                          <span
                            className={`${styles.teamName} ${
                              m.awayGalician ? styles.galicianName : ""
                            }`}
                          >
                            {m.awayTeam}
                          </span>
                        </div>
                        <span className={styles.teamScore}>
                          {m.awayScore !== null ? m.awayScore : "–"}
                        </span>
                      </div>
                      <TeamGoals
                        team="away"
                        goals={m.goals}
                        locale={locale}
                        id={`goals-${m.id}-away`}
                      />
                    </div>
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

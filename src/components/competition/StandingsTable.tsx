import { type Locale, t } from "../../i18n/index.ts";
import type { StandingsResponse } from "../../lib/explorer-client.ts";
import { getGalicianClub, isGalicianClub } from "../../model/index.ts";
import styles from "./StandingsTable.module.css";

type Props = {
  standingsData: StandingsResponse;
  locale: Locale;
};

export function StandingsTable({ standingsData, locale }: Props) {
  const standings = standingsData.standings || [];

  return (
    <div className={styles.container} data-testid="standings-table">
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.pos}>#</th>
            <th>{t(locale, "competitions.title")}</th>
            <th className={styles.num}>{t(locale, "competitions.played")}</th>
            <th className={styles.num}>{t(locale, "competitions.won")}</th>
            <th className={styles.num}>{t(locale, "competitions.drawn")}</th>
            <th className={styles.num}>{t(locale, "competitions.lost")}</th>
            <th className={styles.num}>{t(locale, "competitions.goalsFor")}</th>
            <th className={styles.num}>
              {t(locale, "competitions.goalsAgainst")}
            </th>
            <th className={styles.num}>{t(locale, "competitions.diff")}</th>
            <th className={styles.pts}>{t(locale, "competitions.points")}</th>
            <th>{t(locale, "competitions.form")}</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row) => {
            const club = getGalicianClub(row.teamId);
            const isGalician =
              isGalicianClub(row.teamId) ||
              row.teamName.toLowerCase().includes("deportivo abanca") ||
              row.teamName.toLowerCase().includes("as celtas") ||
              row.teamName.toLowerCase().includes("celta") ||
              row.teamName.toLowerCase().includes("deportivo");

            const isTop = row.position <= 3;
            const isBottom = row.position >= Math.max(standings.length - 1, 15);

            const dg = row.goalsFor - row.goalsAgainst;
            const dgLabel = dg > 0 ? `+${dg}` : `${dg}`;

            return (
              <tr
                key={row.teamId || row.position}
                className={isGalician ? styles.rowGalician : undefined}
                data-team-id={row.teamId}
                data-galician={isGalician ? "true" : undefined}
              >
                <td
                  className={`${styles.pos} ${
                    isTop ? styles.posTop : isBottom ? styles.posBottom : ""
                  }`}
                >
                  {row.position}
                </td>
                <td>
                  <div className={styles.teamCell}>
                    {club?.shield ? (
                      // biome-ignore lint/performance/noImgElement: local SVG shield
                      <img
                        src={club.shield}
                        className={styles.shield}
                        alt=""
                        aria-hidden="true"
                      />
                    ) : (
                      <span
                        className={styles.shieldPlaceholder}
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={
                        isGalician ? styles.galicianTeamName : styles.teamName
                      }
                    >
                      {club?.name || row.teamName}
                    </span>
                  </div>
                </td>
                <td className={styles.num}>{row.played}</td>
                <td className={styles.num}>{row.won}</td>
                <td className={styles.num}>{row.drawn}</td>
                <td className={styles.num}>{row.lost}</td>
                <td className={styles.num}>{row.goalsFor}</td>
                <td className={styles.num}>{row.goalsAgainst}</td>
                <td className={styles.num}>{dgLabel}</td>
                <td className={styles.pts}>{row.points}</td>
                <td>
                  <div className={styles.formCell}>
                    {(row.form || []).map((f, idx) => {
                      const letter = f.toUpperCase();
                      const formClass =
                        letter === "W" || letter === "V"
                          ? styles.formW
                          : letter === "D" || letter === "E"
                            ? styles.formD
                            : styles.formL;

                      return (
                        <span
                          // biome-ignore lint/suspicious/noArrayIndexKey: form results have no unique id
                          key={`${row.teamId || row.position}-f-${idx}`}
                          className={`${styles.formDot} ${formClass}`}
                        >
                          {letter}
                        </span>
                      );
                    })}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className={styles.legendFooter}>
        <div className={styles.legendItem}>
          <span
            className={styles.legendMarker}
            style={{ background: "var(--marca)" }}
          />
          <span>Postos de honra / Champions</span>
        </div>
        <div className={styles.legendItem}>
          <span
            className={styles.legendMarker}
            style={{ background: "var(--alerta)" }}
          />
          <span>Zona de descenso</span>
        </div>
        <div className={styles.legendItem}>
          <span
            className={styles.legendMarker}
            style={{ background: "var(--directo)" }}
          />
          <span>Equipo galego</span>
        </div>
      </div>
    </div>
  );
}

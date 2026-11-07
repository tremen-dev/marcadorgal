import { type Locale, t } from "../../i18n/index.ts";
import {
  type CompetitionMetadata,
  getGalicianClub,
} from "../../model/index.ts";
import styles from "./CompetitionHeader.module.css";

type Props = {
  competition: CompetitionMetadata;
  locale: Locale;
  activeTab: "overview" | "standings" | "calendar";
};

export function CompetitionHeader({ competition, locale, activeTab }: Props) {
  const prefix = locale === "es" ? "/es" : "";
  const homeUrl = prefix || "/";
  const featuredClub = competition.featuredGalicianTeamId
    ? getGalicianClub(competition.featuredGalicianTeamId)
    : undefined;

  const categoryLabel =
    competition.category === "femenino"
      ? t(locale, "competitions.women")
      : t(locale, "competitions.men");

  return (
    <header className={styles.header} data-testid="competition-header">
      <div className={styles.topRow}>
        <a href={homeUrl} className={styles.backLink}>
          ‹ {t(locale, "competitions.backToHome")}
        </a>
        <span className={styles.categoryTag}>{categoryLabel}</span>
      </div>

      <div className={styles.titleRow}>
        <span
          className={styles.badge}
          style={{ backgroundColor: competition.color }}
          aria-hidden="true"
        />
        <h1 className={styles.title}>{competition.officialName}</h1>
      </div>

      {featuredClub && (
        <div
          className={styles.featuredBox}
          data-testid="featured-galician-club"
        >
          {featuredClub.shield && (
            // biome-ignore lint/performance/noImgElement: local SVG shield
            <img
              src={featuredClub.shield}
              className={styles.featuredShield}
              alt=""
              aria-hidden="true"
            />
          )}
          <div className={styles.featuredText}>
            <span className={styles.featuredLabel}>
              {t(locale, "competitions.galicianTeam")}
            </span>
            <span className={styles.featuredName}>{featuredClub.name}</span>
          </div>
        </div>
      )}

      <nav className={styles.tabs} aria-label={competition.shortName}>
        <a
          href={`${prefix}/competicion/${competition.id}`}
          className={`${styles.tab} ${activeTab === "overview" ? styles.activeTab : ""}`}
        >
          {t(locale, "competitions.overview")}
        </a>
        <a
          href={`${prefix}/clasificacion/${competition.id}`}
          className={`${styles.tab} ${activeTab === "standings" ? styles.activeTab : ""}`}
        >
          {t(locale, "competitions.standings")}
        </a>
        <a
          href={`${prefix}/calendario/${competition.id}`}
          className={`${styles.tab} ${activeTab === "calendar" ? styles.activeTab : ""}`}
        >
          {t(locale, "competitions.calendar")}
        </a>
      </nav>
    </header>
  );
}

import { LOCALES, type Locale, t } from "@/i18n";
import { countFilters } from "@/xornada/filter";
import type { XornadaCompetition, XornadaDay } from "@/xornada/view";
import { CompetitionNav } from "./CompetitionNav";
import { CompetitionSection } from "./CompetitionSection";
import styles from "./Xornada.module.css";
import { DayStrip, FilterPills } from "./XornadaControls";
import { XornadaFilters } from "./XornadaFilters";

type Props = {
  locale: Locale;
  competitions: XornadaCompetition[];
  // SPEC-023 CA-1: the days of the served xornada (xornadaDays).
  days: XornadaDay[];
  // The same screen in each language, for the gl·es selector.
  paths: Readonly<Record<Locale, string>>;
  // SPEC-020 CA-6: the data could not be read. Said in words, never shown as
  // an empty xornada (D-9).
  unavailable?: boolean;
};

export function XornadaScreen({
  locale,
  competitions,
  days,
  paths,
  unavailable = false,
}: Props) {
  const rows = competitions.flatMap((c) => c.rows);
  const hasRows = rows.length > 0;
  return (
    <div className={styles.page} data-xornada>
      <header className={styles.bar}>
        <span className={styles.logo}>
          marcador<span className={styles.mark}>▮</span>gal
        </span>
        <span className={styles.spacer} />
        <nav
          className={styles.locales}
          aria-label={t(locale, "xornada.locale")}
          data-testid="locale-switch"
        >
          {LOCALES.map((other, i) => (
            <span key={other}>
              {i > 0 && (
                <span className={styles.localeDot} aria-hidden="true">
                  ·
                </span>
              )}
              <a
                className={
                  other === locale ? styles.localeCurrent : styles.locale
                }
                href={paths[other]}
                hrefLang={other}
                lang={other}
                aria-current={other === locale ? "page" : undefined}
                data-locale-href={paths[other]}
              >
                {t(locale, `locales.${other}`)}
              </a>
            </span>
          ))}
        </nav>
      </header>
      {hasRows && (
        <div className={styles.controls}>
          <DayStrip days={days} locale={locale} />
          <FilterPills
            counts={countFilters(rows, null)}
            locale={locale}
            selfHref={paths[locale]}
          />
        </div>
      )}
      <div className={styles.body}>
        {hasRows && (
          <CompetitionNav competitions={competitions} locale={locale} />
        )}
        <main className={styles.main}>
          <h1 className={styles.srOnly}>{t(locale, "xornada.title")}</h1>
          {unavailable && (
            <p className={styles.unavailable} data-testid="xornada-unavailable">
              {t(locale, "xornada.unavailable")}
            </p>
          )}
          {competitions.map((competition) => (
            <CompetitionSection
              key={competition.competitionId}
              competition={competition}
              locale={locale}
            />
          ))}
          {hasRows && (
            <p
              className={styles.empty}
              hidden
              data-xornada-empty
              data-testid="xornada-empty"
            >
              {t(locale, "xornada.empty")}
            </p>
          )}
        </main>
      </div>
      {hasRows && <XornadaFilters />}
    </div>
  );
}

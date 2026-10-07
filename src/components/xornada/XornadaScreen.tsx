import { LOCALES, type Locale, t } from "@/i18n";
import type { XornadaCompetition } from "@/xornada/view";
import { CompetitionSection } from "./CompetitionSection";
import styles from "./Xornada.module.css";

type Props = {
  locale: Locale;
  competitions: XornadaCompetition[];
  // The same screen in each language, for the gl·es selector.
  paths: Readonly<Record<Locale, string>>;
  // SPEC-020 CA-6: the data could not be read. Said in words, never shown as
  // an empty xornada (D-9).
  unavailable?: boolean;
};

export function XornadaScreen({
  locale,
  competitions,
  paths,
  unavailable = false,
}: Props) {
  return (
    <div className={styles.page}>
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
              >
                {t(locale, `locales.${other}`)}
              </a>
            </span>
          ))}
        </nav>
      </header>
      <main>
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
      </main>
    </div>
  );
}

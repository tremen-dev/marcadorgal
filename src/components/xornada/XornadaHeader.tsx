import type { Neighbours } from "@/board/weeks";
import { LOCALES, type Locale, t } from "@/i18n";
import { Wordmark } from "../brand/Wordmark";
import styles from "./Xornada.module.css";
import { WeekArrow } from "./XornadaControls";

// SPEC-028 CA-4 (H-5): the logo goes back to the current xornada, a plain
// navigation (cached, the same with and without JavaScript).
const HOME: Readonly<Record<Locale, string>> = { gl: "/", es: "/es" };

type Props = {
  locale: Locale;
  paths: Readonly<Record<Locale, string>>;
  // SPEC-028 CA-6: the text of the one <h1> (xornadaHeading).
  heading: string;
  // The strip is served: on mobile the title row goes under it.
  strip: boolean;
  // SPEC-072 CA-1 (H-1 = A): ‹ and › on both sides of the title's text, when
  // the strip that used to hold them is not served.
  arrows?: Neighbours;
};

// The top bar: logo, the visible title and gl·es. SPEC-028 CA-6 (H-6 = A):
// on desktop the title sits where Escritorio.tpl.html has the «Xornada» tab;
// on mobile it is the 42 px row of Movil.tpl.html's segment, under the strip.
// SPEC-072: the row is the title's room; the arrows are siblings of the
// <h1>, so they never enter its accessible name.
export function XornadaHeader({
  locale,
  paths,
  heading,
  strip,
  arrows,
}: Props) {
  return (
    <header className={styles.bar} data-strip={strip ? "true" : undefined}>
      <a
        className={styles.logo}
        href={HOME[locale]}
        aria-label={t(locale, "xornada.home")}
        data-testid="home-link"
      >
        <Wordmark />
      </a>
      <div
        className={styles.title}
        data-arrows={arrows ? "true" : undefined}
        data-testid="xornada-title-row"
      >
        {arrows && (
          <WeekArrow href={arrows.previous} dir="previous" locale={locale} />
        )}
        <h1 className={styles.heading} data-testid="xornada-title">
          <span className={styles.titleText}>{heading}</span>
        </h1>
        {arrows && <WeekArrow href={arrows.next} dir="next" locale={locale} />}
      </div>
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
  );
}

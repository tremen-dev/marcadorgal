import type { Neighbours } from "@/board/weeks";
import { type Locale, t } from "@/i18n";
import { Wordmark } from "../brand/Wordmark";
import { FiltersToggle } from "./FiltersToggle";
import styles from "./Xornada.module.css";
import { WeekArrow } from "./XornadaControls";

// SPEC-028 CA-4 (H-5): the logo goes back to the current xornada, a plain
// navigation (cached, the same with and without JavaScript).
const HOME: Readonly<Record<Locale, string>> = { gl: "/", es: "/es" };

type Props = {
  locale: Locale;
  // SPEC-028 CA-6: the text of the one <h1> (xornadaHeading).
  heading: string;
  // The strip is served: on mobile the title row goes under it.
  strip: boolean;
  // SPEC-082 CA-3: the screen has the filters panel, so the bar carries the
  // button that unfolds it on mobile.
  filters: boolean;
  // SPEC-072 CA-1 (H-1 = A): ‹ and › on both sides of the title's text, when
  // the strip that used to hold them is not served.
  arrows?: Neighbours;
};

// The top bar: logo and motto, the visible title and, on mobile, the filters
// button (SPEC-082: gl·es moved to the footer). SPEC-028 CA-6 (H-6 = A):
// on desktop the title sits where Escritorio.tpl.html has the «Xornada» tab;
// on mobile it is the 42 px row of Movil.tpl.html's segment, under the strip.
// SPEC-072: the row is the title's room; the arrows are siblings of the
// <h1>, so they never enter its accessible name.
export function XornadaHeader({
  locale,
  heading,
  strip,
  filters,
  arrows,
}: Props) {
  return (
    <header className={styles.bar} data-strip={strip ? "true" : undefined}>
      {/* SPEC-081 (ADR-035): the motto beside the wordmark (desktop) or
          under it (mobile), outside the link, so the link's name stays
          xornada.home (WCAG 2.5.3). Always Galician, also in /es. Its box
          is the container that hides it whole when the title needs the
          room (CA-4), with no JavaScript. */}
      <div className={styles.brand}>
        <a
          className={styles.logo}
          href={HOME[locale]}
          aria-label={t(locale, "xornada.home")}
          data-testid="home-link"
        >
          <Wordmark />
        </a>
        <div className={styles.lemaBox}>
          <span className={styles.lema} lang="gl" data-testid="xornada-lema">
            {t(locale, "xornada.lema")}
          </span>
        </div>
      </div>
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
      {filters && <FiltersToggle locale={locale} />}
    </header>
  );
}

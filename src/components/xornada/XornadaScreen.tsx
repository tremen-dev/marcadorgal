import type { ReactNode } from "react";
import type { Neighbours } from "@/board/weeks";
import { LOCALES, type Locale, t } from "@/i18n";
import type { XornadaCompetition, XornadaDay } from "@/xornada/view";
import styles from "./Xornada.module.css";
import { XornadaBody } from "./XornadaBody";
import { XornadaFilters } from "./XornadaFilters";
import { XornadaLive, type XornadaLiveProps } from "./XornadaLive";

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
  // SPEC-024: / and /es keep themselves up to date in the client; the demos
  // do not (they neither subscribe nor poll).
  live?: Pick<XornadaLiveProps, "matches" | "servedAt" | "season" | "etag">;
  // SPEC-027: ‹ and › of the strip, and the freshness line of a week page
  // (a snapshot, never live: H-4).
  arrows?: Neighbours;
  freshness?: ReactNode;
};

export function XornadaScreen({
  locale,
  competitions,
  days,
  paths,
  unavailable = false,
  live,
  arrows,
  freshness,
}: Props) {
  const hasRows = competitions.some((c) => c.rows.length > 0);
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
      {live === undefined ? (
        <XornadaBody
          locale={locale}
          competitions={competitions}
          days={days}
          paths={paths}
          unavailable={unavailable}
          arrows={arrows}
          freshness={freshness}
        />
      ) : (
        <XornadaLive
          locale={locale}
          paths={paths}
          days={days}
          unavailable={unavailable}
          arrows={arrows}
          {...live}
        />
      )}
      {(hasRows || live !== undefined) && <XornadaFilters />}
    </div>
  );
}

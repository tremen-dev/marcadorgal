import type { ReactNode } from "react";
import type { Neighbours } from "@/board/weeks";
import { type Locale, t } from "@/i18n";
import { countFilters } from "@/xornada/filter";
import type { XornadaCompetition, XornadaDay } from "@/xornada/view";
import { CompetitionNav } from "./CompetitionNav";
import { CompetitionSection } from "./CompetitionSection";
import styles from "./Xornada.module.css";
import { DayStrip, FilterPills } from "./XornadaControls";

// The controls, the sidebar and the sections of the screen. Rendered on the
// server for the demos and by XornadaLive (SPEC-024 H-1) for / and /es, with
// the same components either way.

export type XornadaBodyProps = {
  locale: Locale;
  competitions: readonly XornadaCompetition[];
  days: readonly XornadaDay[];
  paths: Readonly<Record<Locale, string>>;
  unavailable?: boolean;
  // SPEC-024 CA-8: the line of the browser clock, between the controls and
  // the first competition.
  freshness?: ReactNode;
  // SPEC-024 CA-9: matchId → minutes since its last observation.
  ages?: ReadonlyMap<string, number>;
  // SPEC-027 CA-6: ‹ and › of the strip (the public pages only).
  arrows?: Neighbours;
};

export function XornadaBody({
  locale,
  competitions,
  days,
  paths,
  unavailable = false,
  freshness,
  ages,
  arrows,
}: XornadaBodyProps) {
  const rows = competitions.flatMap((c) => c.rows);
  const hasRows = rows.length > 0;
  return (
    <>
      {hasRows && (
        <div className={styles.controls}>
          <DayStrip days={days} locale={locale} arrows={arrows} />
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
          {freshness}
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
              ages={ages}
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
    </>
  );
}

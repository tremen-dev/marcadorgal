import type { ReactNode } from "react";
import { SHOW_DAY_STRIP, SHOW_TABLE_LINK } from "@/app/config";
import type { Neighbours } from "@/board/weeks";
import { type Locale, t } from "@/i18n";
import { countFilters } from "@/xornada/filter";
import {
  type ProvisionalDisplay,
  provisionalLegendShown,
} from "@/xornada/qualifier";
import type { XornadaCompetition, XornadaDay } from "@/xornada/view";
import { CompetitionSection } from "./CompetitionSection";
import { xornadaHeading } from "./labels";
import type { RecentGoalView } from "./MatchRow";
import styles from "./Xornada.module.css";
import { DayStrip, FilterPills } from "./XornadaControls";
import { XornadaHeader } from "./XornadaHeader";

// The controls and the sections of the screen. Rendered on the
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
  // SPEC-027 CA-6, SPEC-072: ‹ and › (the public pages only).
  arrows?: Neighbours;
  // SPEC-034 CA-5: the mode of the web's configuration, for the legend.
  provisionalDisplay: ProvisionalDisplay;
  // SPEC-041 CA-3, CA-4: the render's instant (the server's, or the
  // client's clock of SPEC-024) and RECENT_GOAL_MINUTES/RECENT_GOAL_MARK.
  recentGoal?: RecentGoalView;
  // Whether to show the strip of days (SHOW_DAY_STRIP).
  showDayStrip?: boolean;
  // Whether each competition links to its table (SHOW_TABLE_LINK).
  showTableLink?: boolean;
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
  provisionalDisplay,
  recentGoal,
  showDayStrip = SHOW_DAY_STRIP,
  showTableLink = SHOW_TABLE_LINK,
}: XornadaBodyProps) {
  const rows = competitions.flatMap((c) => c.rows);
  const hasRows = rows.length > 0;
  return (
    <>
      {/* SPEC-028 CA-6: rendered here, so the client's repaint (SPEC-024)
          keeps the title in step with the days. */}
      <XornadaHeader
        locale={locale}
        heading={xornadaHeading(days, locale)}
        strip={hasRows && showDayStrip}
        filters={hasRows}
        // SPEC-072 CA-1: with the strip, the arrows stay at its ends
        // (SPEC-027 CA-6); without it, they flank the title. Never both.
        arrows={hasRows && !showDayStrip ? arrows : undefined}
      />
      {!hasRows && <div className={styles.titleSpace} />}
      {hasRows && (
        <div className={styles.controls}>
          {showDayStrip && (
            <DayStrip days={days} locale={locale} arrows={arrows} />
          )}
          {/* The title row's room on mobile (SPEC-082: the panel under it
              may be folded, so the room is its own). */}
          <div className={styles.titleRoom} />
          <FilterPills
            counts={countFilters(rows, null)}
            locale={locale}
            selfHref={paths[locale]}
          />
        </div>
      )}
      {/* SPEC-040 CA-4 (H-5): no sidebar; the page's width is the main's. */}
      <main className={styles.main}>
        {freshness}
        {unavailable && (
          <p className={styles.unavailable} data-testid="xornada-unavailable">
            {t(locale, "xornada.unavailable")}
          </p>
        )}
        {/* SPEC-040 CA-4 (H-2, H-3): on desktop, one column per
              competition, in tier order, aligned left; on mobile, a list. */}
        <div className={styles.columns} data-testid="xornada-columns">
          {competitions.map((competition) => (
            <CompetitionSection
              key={competition.competitionId}
              competition={competition}
              locale={locale}
              ages={ages}
              days={days}
              recentGoal={recentGoal}
              showTableLink={showTableLink}
            />
          ))}
        </div>
        {hasRows && (
          <p
            className={styles.empty}
            hidden
            data-xornada-empty
            data-testid="xornada-empty"
            data-empty-filter={t(locale, "xornada.empty")}
            data-empty-leagues={t(locale, "xornada.leaguesEmpty")}
          >
            {t(locale, "xornada.empty")}
          </p>
        )}
        {/* SPEC-034 CA-3: one legend for the mark, at the foot of the list.
              Served shown when a served row is provisional; the client keeps
              it in step with the visible rows (XornadaFilters). */}
        {hasRows && provisionalDisplay === "mark" && (
          <p
            className={styles.legend}
            hidden={
              !provisionalLegendShown(
                provisionalDisplay,
                rows.map((r) => r.qualifier),
              )
            }
            data-provisional-legend
            data-testid="provisional-legend"
          >
            {t(locale, "qualifier.provisionalLegend")}
          </p>
        )}
      </main>
    </>
  );
}

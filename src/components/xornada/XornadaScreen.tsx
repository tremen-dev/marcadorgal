import type { ReactNode } from "react";
import type { Neighbours } from "@/board/weeks";
import type { Locale } from "@/i18n";
import type { Instant } from "@/model";
import type { ProvisionalDisplay } from "@/xornada/qualifier";
import type { RecentGoalMark } from "@/xornada/recent-goal";
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
  live?: Pick<
    XornadaLiveProps,
    "matches" | "servedAt" | "season" | "etag" | "galicians"
  >;
  // SPEC-027: ‹ and › of the strip, and the freshness line of a week page
  // (a snapshot, never live: H-4).
  arrows?: Neighbours;
  freshness?: ReactNode;
  // SPEC-034 CA-5: PROVISIONAL_DISPLAY, passed by the page; the rows of
  // `competitions` were built with the same mode.
  provisionalDisplay: ProvisionalDisplay;
  // SPEC-041 CA-3: RECENT_GOAL_MINUTES and RECENT_GOAL_MARK, passed by the
  // page with the instant of its render, to the screen and to the client.
  recentGoal: { now: Instant; minutes: number; mark: RecentGoalMark };
  // Whether to show the strip of days (SHOW_DAY_STRIP).
  showDayStrip?: boolean;
  // Whether each competition links to its table (SHOW_TABLE_LINK).
  showTableLink?: boolean;
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
  provisionalDisplay,
  recentGoal,
  showDayStrip,
  showTableLink,
}: Props) {
  const hasRows = competitions.some((c) => c.rows.length > 0);
  return (
    <div className={styles.page} data-xornada>
      {live === undefined ? (
        <XornadaBody
          locale={locale}
          competitions={competitions}
          days={days}
          paths={paths}
          unavailable={unavailable}
          arrows={arrows}
          freshness={freshness}
          provisionalDisplay={provisionalDisplay}
          recentGoal={{
            now: Date.parse(recentGoal.now),
            minutes: recentGoal.minutes,
            mark: recentGoal.mark,
          }}
          showDayStrip={showDayStrip}
          showTableLink={showTableLink}
        />
      ) : (
        <XornadaLive
          locale={locale}
          paths={paths}
          days={days}
          unavailable={unavailable}
          arrows={arrows}
          provisionalDisplay={provisionalDisplay}
          recentGoalMinutes={recentGoal.minutes}
          recentGoalMark={recentGoal.mark}
          showDayStrip={showDayStrip}
          showTableLink={showTableLink}
          {...live}
        />
      )}
      {(hasRows || live !== undefined) && <XornadaFilters />}
      {/* SPEC-082 CA-6: without JavaScript there is no button to open the
          panel: the pills and «Ligas» are shown as before (SPEC-023 CA-6).
          With it, the first paint is already folded. */}
      <noscript>
        <style>{`.${styles.filtersToggle}{display:none}.${styles.controls} .${styles.filters}:not([data-open]){display:flex}`}</style>
      </noscript>
    </div>
  );
}

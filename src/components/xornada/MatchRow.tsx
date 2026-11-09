"use client";

import { useEffect, useState } from "react";
import { formatTime, type Locale, t } from "@/i18n";
import {
  isRecent,
  pulseIterations,
  type RecentGoalClock,
  type RecentGoalMark,
  recentGoals,
  watchRecentGoal,
} from "@/xornada/recent-goal";
import { minuteLabel, type XornadaRow } from "@/xornada/view";
import { TeamGoals } from "../goals/TeamGoals";
import { rowDateLabel } from "./labels";
import { RecentGoalScore } from "./RecentGoalScore";
import { type TeamNameTone, teamNameTone } from "./team-name";
import styles from "./Xornada.module.css";

type Props = {
  row: XornadaRow;
  locale: Locale;
  // SPEC-024 CA-9 (RN-11, H-4): minutes since the last observation of a live
  // row, only from 2 min (rowAge); the source clock, never the browser's.
  age?: number | null;
  // SPEC-040 CA-2 (H-4): the row's date is today, so it goes in capitals.
  today?: boolean;
  // SPEC-041 CA-3, CA-4: the render's instant (ms) and the web's
  // RECENT_GOAL_MINUTES and RECENT_GOAL_MARK. Without it, no mark.
  recentGoal?: RecentGoalView;
};

export type RecentGoalView = {
  now: number;
  minutes: number;
  mark: RecentGoalMark;
};

const NO_RECENT_GOALS = { home: null, away: null } as const;

const browserClock: RecentGoalClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (id) => window.clearTimeout(id as number),
};

const cx = (...names: (string | false | null | undefined)[]): string =>
  names.filter(Boolean).join(" ");

const TONE_CLASS: Readonly<Record<TeamNameTone, string | undefined>> = {
  plain: undefined,
  winner: styles.winner,
  loser: styles.loser,
  dim: styles.dim,
  galician: styles.galician,
  galicianDeep: styles.galicianDeep,
};

// ADR-005: ember only for live; amber for what awaits a person (postponed,
// suspended, provisional); red for sen sinal. Every colour has its label.
function marginColor(row: XornadaRow): string | undefined {
  if (row.qualifier === "sen_sinal" && row.status === "live") return styles.red;
  if (row.status === "live") return styles.ember;
  if (row.status === "postponed" || row.status === "suspended")
    return styles.amber;
  return undefined;
}

function qualifierColor(row: XornadaRow): string {
  return row.qualifier === "sen_sinal" ? styles.red : styles.amber;
}

// SPEC-040 CA-2: the date (never live), the part (live) or nothing, with
// its height kept.
function secondLine(row: XornadaRow, today: boolean, locale: Locale) {
  if (row.date !== null) return rowDateLabel(row.date, today, locale);
  if (row.part === "halfTime")
    return t(locale, "xornada.halfTime").toLocaleUpperCase(locale);
  if (row.part === null) return null;
  const [short, long] =
    row.part === "first"
      ? (["xornada.firstPart", "xornada.firstPartLong"] as const)
      : (["xornada.secondPart", "xornada.secondPartLong"] as const);
  return (
    <>
      <span aria-hidden="true">{t(locale, short)}</span>
      <span className={styles.srOnly}>{t(locale, long)}</span>
    </>
  );
}

export function MatchRow({
  row,
  locale,
  age = null,
  today = false,
  recentGoal,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [clock, setClock] = useState(recentGoal?.now ?? 0);

  const isLive = row.status === "live";
  const noSignal = row.qualifier === "sen_sinal";
  const { margin, qualifierDisplay: qualifier } = row;

  const allGoals = row.goals ?? [];
  const hasGoals = allGoals.length > 0;
  // SPEC-068 CA-1, CA-5: one block per side with goals, each with its id;
  // aria-controls lists the ids of the blocks present, in DOM order.
  const goalsId = (side: "home" | "away") => `goals-${row.matchId}-${side}`;
  const controls = (["home", "away"] as const)
    .filter((side) => allGoals.some((g) => g.team === side))
    .map(goalsId)
    .join(" ");

  // SPEC-040 CA-2 (H-1): the first line is the time, the minute or the state
  // word (at half-time, «En xogo»); the second, the date or the part.
  const marginText =
    margin.kind === "time"
      ? formatTime(margin.kickoff, locale)
      : margin.kind === "minute"
        ? minuteLabel(margin)
        : t(locale, row.statusKey);
  // SPEC-021 H-2: at half-time there is no minute to run, so no live dot;
  // the ember inset still says the match is in play.
  const showDot = isLive && !noSignal && margin.kind !== "halfTime";
  const saysStatus = margin.kind === "status" || margin.kind === "halfTime";
  const nameClass = (side: "home" | "away") =>
    cx(styles.team, TONE_CLASS[teamNameTone(row, side)]);
  const galician = (side: "home" | "away") =>
    (side === "home" ? row.homeGalician : row.awayGalician) || undefined;
  const scoreClass = (side: "home" | "away") =>
    cx(
      styles.score,
      row.score === null && styles.scoreEmpty,
      row.score !== null && noSignal && styles.scoreNoSignal,
      row.winner !== null && row.winner !== side && styles.loser,
    );
  const scoreText = (side: "home" | "away") =>
    row.score === null ? "–" : String(row.score[side]);

  // SPEC-041 CA-4: the recent number, decided at the render's instant; the
  // browser's clock takes over in RecentGoalScore (CA-5).
  const recent =
    recentGoal === undefined
      ? NO_RECENT_GOALS
      : recentGoals(row, recentGoal.now, recentGoal.minutes);

  const homeUntil = recent.home;
  const awayUntil = recent.away;

  // SPEC-056 CA-3: synchronise browser clock with goal expiration
  useEffect(() => {
    if (!homeUntil && !awayUntil) return;
    const target =
      homeUntil && awayUntil
        ? Date.parse(homeUntil) > Date.parse(awayUntil)
          ? homeUntil
          : awayUntil
        : (homeUntil ?? awayUntil);
    if (!target) return;
    return watchRecentGoal(target, browserClock, setClock);
  }, [homeUntil, awayUntil]);

  const score = (side: "home" | "away") => {
    const until = recent[side];
    if (recentGoal === undefined || until === null)
      return (
        <span className={scoreClass(side)} data-testid="score">
          {scoreText(side)}
        </span>
      );
    return (
      <RecentGoalScore
        key={`${side}-${until}`}
        until={until}
        now={recentGoal.now}
        mark={recentGoal.mark}
        className={scoreClass(side)}
        text={scoreText(side)}
        words={t(locale, "xornada.recentGoal")}
        label={t(locale, "xornada.recentGoalLabel")}
      />
    );
  };

  // SPEC-068 CA-5: a click anywhere on the row toggles, also inside a block.
  const handleToggle = () => {
    if (!hasGoals) return;
    setIsExpanded((prev) => !prev);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!hasGoals) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsExpanded((prev) => !prev);
    }
  };

  const goals = (side: "home" | "away") => (
    <TeamGoals
      team={side}
      goals={allGoals}
      id={goalsId(side)}
      expanded={isExpanded}
    />
  );

  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: when hasGoals is true, role is button which supports aria-expanded
    <li
      className={cx(
        styles.row,
        isLive && !noSignal && styles.live,
        noSignal && styles.noSignal,
        hasGoals && styles.rowWithGoals,
      )}
      data-testid="match-row"
      data-match-id={row.matchId}
      data-status={row.status}
      data-qualifier={row.qualifier}
      data-day={row.day}
      data-version={row.version}
      data-has-goals={hasGoals ? "true" : undefined}
      data-expanded={hasGoals ? (isExpanded ? "true" : "false") : undefined}
      role={hasGoals ? "button" : undefined}
      tabIndex={hasGoals ? 0 : undefined}
      aria-expanded={hasGoals ? isExpanded : undefined}
      aria-controls={hasGoals ? controls : undefined}
      aria-label={
        hasGoals
          ? `${row.home} ${scoreText("home")}, ${row.away} ${scoreText("away")}. ${t(
              locale,
              isExpanded ? "xornada.collapseGoals" : "xornada.expandGoals",
            )}`
          : undefined
      }
      onClick={hasGoals ? handleToggle : undefined}
      onKeyDown={hasGoals ? handleKeyDown : undefined}
    >
      <div className={styles.margin}>
        <span className={styles.marginLines} data-testid="match-margin-lines">
          <span
            className={cx(
              styles.marginMain,
              margin.kind === "minute" && styles.marginMinute,
              marginColor(row),
            )}
            data-testid="match-margin"
          >
            {showDot && <span className={styles.dot} aria-hidden="true" />}
            {marginText}
          </span>
          {!saysStatus && (
            <span className={styles.srOnly}>{t(locale, row.statusKey)}</span>
          )}
          <span className={styles.marginSub} data-testid="match-margin-sub">
            {secondLine(row, today, locale)}
          </span>
        </span>
        {/* SPEC-034: label (CA-2), mark (CA-3) or nothing (CA-4). */}
        {qualifier.kind === "label" && (
          <span
            className={cx(styles.qualifier, qualifierColor(row))}
            data-testid="match-qualifier"
          >
            {t(locale, qualifier.key)}
          </span>
        )}
        {qualifier.kind === "mark" && (
          <>
            <span
              className={cx(styles.mark, styles.amber)}
              aria-hidden="true"
              data-testid="provisional-mark"
            >
              *
            </span>
            <span className={styles.srOnly}>{t(locale, qualifier.key)}</span>
          </>
        )}
        {hasGoals && (
          <span
            className={styles.goalsAffordance}
            aria-hidden="true"
            data-testid="goals-affordance"
          >
            {isExpanded ? "▾" : "▸"}
          </span>
        )}
      </div>
      {/* SPEC-041 CA-4: the «label» variant gives the pill its own track,
          as wide as the pill when there is one, none otherwise. */}
      <div
        className={cx(
          styles.sides,
          recentGoal?.mark === "label" && styles.sidesTag,
        )}
      >
        <span
          className={nameClass("home")}
          data-testid="team-name"
          data-galician={galician("home")}
        >
          {row.home}
        </span>
        {score("home")}
        {goals("home")}
        <span
          className={nameClass("away")}
          data-testid="team-name"
          data-galician={galician("away")}
        >
          {row.away}
        </span>
        {score("away")}
        {goals("away")}
      </div>
      {age !== null && (
        <span className={styles.rowAge} data-testid="row-age">
          {t(locale, "freshness.lastData", { n: age })}
        </span>
      )}
    </li>
  );
}

"use client";

import { useEffect, useState } from "react";
import type { Instant } from "@/model";
import {
  isRecent,
  pulseIterations,
  type RecentGoalClock,
  type RecentGoalMark,
  watchRecentGoal,
} from "@/xornada/recent-goal";
import styles from "./Xornada.module.css";

// SPEC-041 CA-4, CA-5: the number of a side that scored a little while ago.
// The first render uses the render's instant (`now`), so the served HTML and
// the hydration agree and, without JavaScript, the mark is the served one
// (its pulses stop on their own). With JavaScript the browser's clock takes
// over and one timer takes the whole mark away at `until`, without the
// network. Used by every row, served (demos, weeks) or kept by the client of
// SPEC-024.

const browserClock: RecentGoalClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (id) => window.clearTimeout(id as number),
};

type Props = {
  until: Instant;
  now: number;
  mark: RecentGoalMark;
  // The score's own classes and text (MatchRow).
  className: string;
  text: string;
  // xornada.recentGoal and xornada.recentGoalLabel, resolved by MatchRow.
  words: string;
  label: string;
};

const cx = (...names: (string | false | undefined)[]): string =>
  names.filter(Boolean).join(" ");

export function RecentGoalScore({
  until,
  now,
  mark,
  className,
  text,
  words,
  label,
}: Props) {
  const [clock, setClock] = useState(now);
  useEffect(() => watchRecentGoal(until, browserClock, setClock), [until]);

  if (!isRecent(until, clock))
    return (
      <span className={className} data-testid="score">
        {text}
      </span>
    );
  return (
    <>
      {mark === "label" && (
        <span
          className={styles.goalTag}
          aria-hidden="true"
          data-testid="recent-goal-tag"
        >
          {label}
        </span>
      )}
      <span
        className={cx(
          className,
          styles.recentGoal,
          mark === "box" && styles.recentGoalBox,
        )}
        style={{ animationIterationCount: pulseIterations(until, clock) }}
        data-testid="score"
        data-recent-goal=""
        data-recent-goal-until={until}
      >
        {text}
      </span>
      <span className={styles.srOnly}>{words}</span>
    </>
  );
}

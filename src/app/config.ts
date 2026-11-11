import {
  PROVISIONAL_DISPLAYS,
  type ProvisionalDisplay,
} from "@/xornada/qualifier";
import { RECENT_GOAL_MARKS, type RecentGoalMark } from "@/xornada/recent-goal";

// The web's configuration: editorial choices of the public screen, versioned
// and tested. Changing one is one line and one PR.

// SPEC-034 CA-5 (H-1..H-4): how the screen presents a provisional Decision.
// "label" (the word), "mark" (the glyph * with a legend) or "hidden".
// SPEC-084 CA-1: hidden by default; the aviso legal explains it.
export const PROVISIONAL_DISPLAY: ProvisionalDisplay = "hidden";

// SPEC-084 CA-3 (H-1): the ?provisional= of the demonstration (and only
// there) picks the mode. Absent, or not exactly a mode, it is
// PROVISIONAL_DISPLAY; repeated, the first one counts.
export function provisionalDisplay(
  param: string | readonly string[] | undefined,
): ProvisionalDisplay {
  const wanted = typeof param === "string" ? param : param?.[0];
  return PROVISIONAL_DISPLAYS.find((m) => m === wanted) ?? PROVISIONAL_DISPLAY;
}

// SPEC-041 CA-3 (H-4): how long a goal pulses, in minutes, and how the
// number is marked: "box" (a neutral box around it) or "label" (the «GOL»
// pill). Global to the web, never per competition. SPEC-042 CA-1: «label»
// by default.
export const RECENT_GOAL_MINUTES = 5;
export const RECENT_GOAL_MARK: RecentGoalMark = "label";

// SPEC-042 CA-2: the variable RECENT_GOAL_MARK picks the variant (set in
// Vercel, Production and Preview; read at render). Unset, or not exactly a
// variant, it is RECENT_GOAL_MARK.
export function recentGoalMark(
  env: Readonly<Record<string, string | undefined>>,
): RecentGoalMark {
  const wanted = env.RECENT_GOAL_MARK;
  return RECENT_GOAL_MARKS.find((m) => m === wanted) ?? RECENT_GOAL_MARK;
}

// Whether the strip of days of the matchday is shown on the screen.
// False (hidden) by default.
export const SHOW_DAY_STRIP = false;

// The variable SHOW_DAY_STRIP (or DAY_STRIP) picks whether the strip of days
// is shown (read at render). Unset, or not "true"/"1", it defaults to SHOW_DAY_STRIP.
export function showDayStrip(
  env: Readonly<Record<string, string | undefined>>,
): boolean {
  const wanted = env.SHOW_DAY_STRIP ?? env.DAY_STRIP;
  if (wanted === "true" || wanted === "1") return true;
  if (wanted === "false" || wanted === "0") return false;
  return SHOW_DAY_STRIP;
}

// Whether each competition of the xornada links to its table («Táboa ↗»).
// False (hidden) by default: the tables of Explorer are incomplete
// (2026-11-08: goals at 0, fallback tables of zeros, groups without data).
export const SHOW_TABLE_LINK = false;

// The variable SHOW_TABLE_LINK picks whether the link is shown (read at
// render). "true"/"1" shows it, "false"/"0" hides it; anything else, or
// unset, is SHOW_TABLE_LINK.
export function showTableLink(
  env: Readonly<Record<string, string | undefined>>,
): boolean {
  const wanted = env.SHOW_TABLE_LINK;
  if (wanted === "true" || wanted === "1") return true;
  if (wanted === "false" || wanted === "0") return false;
  return SHOW_TABLE_LINK;
}

import type { ProvisionalDisplay } from "@/xornada/qualifier";
import { RECENT_GOAL_MARKS, type RecentGoalMark } from "@/xornada/recent-goal";

// The web's configuration: editorial choices of the public screen, versioned
// and tested. Changing one is one line and one PR.

// SPEC-034 CA-5 (H-1..H-4): how the screen presents a provisional Decision.
// "label" (the word), "mark" (the glyph * with a legend) or "hidden".
export const PROVISIONAL_DISPLAY: ProvisionalDisplay = "mark";

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

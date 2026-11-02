import type { ProvisionalDisplay } from "@/xornada/qualifier";
import { RECENT_GOAL_MARKS, type RecentGoalMark } from "@/xornada/recent-goal";

// The web's configuration: editorial choices of the public screen, versioned
// and tested. Changing one is one line and one PR.

// SPEC-034 CA-5 (H-1..H-4): how the screen presents a provisional Decision.
// "label" (the word), "mark" (the glyph * with a legend) or "hidden".
export const PROVISIONAL_DISPLAY: ProvisionalDisplay = "mark";

// SPEC-041 CA-3 (H-4): how long a goal pulses, in minutes, and how the
// number is marked: "box" (a neutral box around it) or "label" (the «GOL»
// pill). Global to the web, never per competition.
export const RECENT_GOAL_MINUTES = 5;
export const RECENT_GOAL_MARK: RecentGoalMark = "box";

// SPEC-041 CA-6: the e2e build serves the other variant on a second server
// (playwright.config.ts). Unset, or not a variant, it is RECENT_GOAL_MARK.
export function recentGoalMark(env: {
  E2E_RECENT_GOAL_MARK?: string;
}): RecentGoalMark {
  const wanted = env.E2E_RECENT_GOAL_MARK;
  return RECENT_GOAL_MARKS.find((m) => m === wanted) ?? RECENT_GOAL_MARK;
}

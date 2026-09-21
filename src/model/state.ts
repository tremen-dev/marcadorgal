import { z } from "zod";

export const Score = z.object({
  home: z.int().min(0),
  away: z.int().min(0),
});
export type Score = z.infer<typeof Score>;

// Regulation minute as the provider reports it (frozen at 45/90/105/120
// during stoppage time).
export const Minute = z.int().min(0).max(130);

// Stoppage-time minute, kept apart from the regulation minute (N-8): 45+3 is
// not 48. null when there is no added time; never 0.
export const AddedMinute = z.int().min(1).max(30);

// Only the live branch carries added time; the object schemas strip unknown
// keys, so the other four reject it explicitly instead of dropping it.
const noAddedMinute = { addedMinute: z.never().optional() };
const noScore = { score: z.null(), minute: z.null(), ...noAddedMinute };
const finalScore = { score: Score, minute: z.null(), ...noAddedMinute };

// Discriminated by status, in MatchStatus order: no score before the match,
// a score once it starts, and a minute (with its added time) only while it is
// being played.
export const MatchState = z.discriminatedUnion("status", [
  z.object({ status: z.literal("scheduled"), ...noScore }),
  z.object({
    status: z.literal("live"),
    score: Score,
    minute: Minute.nullable(),
    addedMinute: AddedMinute.nullable(),
  }),
  z.object({ status: z.literal("finished"), ...finalScore }),
  z.object({ status: z.literal("postponed"), ...noScore }),
  z.object({ status: z.literal("suspended"), ...finalScore }),
]);
export type MatchState = z.infer<typeof MatchState>;

export type LiveMinute = Pick<
  Extract<MatchState, { status: "live" }>,
  "minute" | "addedMinute"
>;

// Lexicographic order of (minute ?? -1, addedMinute ?? 0): 45+3 < 46,
// 90 < 90+1, 90+5 < 91. Negative when a is earlier than b.
export function compareLiveMinute(a: LiveMinute, b: LiveMinute): number {
  return (
    (a.minute ?? -1) - (b.minute ?? -1) ||
    (a.addedMinute ?? 0) - (b.addedMinute ?? 0)
  );
}

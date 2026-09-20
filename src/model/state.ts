import { z } from "zod";

export const Score = z.object({
  home: z.int().min(0),
  away: z.int().min(0),
});
export type Score = z.infer<typeof Score>;

export const Minute = z.int().min(0).max(130);

// Discriminated by status: no score before the match, a score once it starts,
// and a minute only while it is being played.
export const MatchState = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("scheduled"),
    score: z.null(),
    minute: z.null(),
  }),
  z.object({
    status: z.literal("postponed"),
    score: z.null(),
    minute: z.null(),
  }),
  z.object({
    status: z.literal("live"),
    score: Score,
    minute: Minute.nullable(),
  }),
  z.object({ status: z.literal("finished"), score: Score, minute: z.null() }),
  z.object({ status: z.literal("suspended"), score: Score, minute: z.null() }),
]);
export type MatchState = z.infer<typeof MatchState>;

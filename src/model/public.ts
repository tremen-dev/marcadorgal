import { z } from "zod";
import { CompetitionId, MatchId } from "./ids.ts";
import { Instant } from "./instant.ts";
import { MatchState } from "./state.ts";
import { Qualifier } from "./vocab.ts";

// What the anonymous public sees of a match (ADR-014 §3) and nothing else:
// never the source, the rule, the observations, the score owners or alerts.
// Every object is strict: an extra key is an error, not something dropped in
// silence, so a leak from board cannot reach the browser unnoticed.

export const PublicTeam = z.strictObject({
  name: z.string().min(1),
  shortName: z.string().min(1).nullable(),
});
export type PublicTeam = z.infer<typeof PublicTeam>;

const fields = {
  matchId: MatchId,
  competitionId: CompetitionId,
  competitionName: z.string().min(1),
  tier: z.int().min(1).max(5),
  round: z.int().min(1),
  kickoff: Instant,
  home: PublicTeam,
  away: PublicTeam,
  qualifier: Qualifier,
  // 0 when the match has no Decision yet (and then decidedAt is null).
  version: z.int().min(0),
  observedAt: Instant.nullable(),
  decidedAt: Instant.nullable(),
};

const [scheduled, live, finished, postponed, suspended] = MatchState.options;

// MatchState, one strict branch per status, in MatchStatus order.
export const PublicMatch = z
  .discriminatedUnion("status", [
    z.strictObject({ ...scheduled.shape, ...fields }),
    z.strictObject({ ...live.shape, ...fields }),
    z.strictObject({ ...finished.shape, ...fields }),
    z.strictObject({ ...postponed.shape, ...fields }),
    z.strictObject({ ...suspended.shape, ...fields }),
  ])
  .refine((m) => (m.version === 0) === (m.decidedAt === null), {
    message: "version is 0 exactly when there is no Decision (decidedAt null)",
    path: ["version"],
  })
  // sen_sinal: in live, or in scheduled with the kickoff past (RN-05, ADR-013 §2).
  .refine(
    (m) =>
      m.qualifier !== "sen_sinal" ||
      m.status === "live" ||
      m.status === "scheduled",
    {
      message: "sen_sinal only applies to live or scheduled matches",
      path: ["qualifier"],
    },
  );
export type PublicMatch = z.infer<typeof PublicMatch>;

import { z } from "zod";
import { MatchId, SourceId, TeamId } from "./ids.ts";
import { Season } from "./vocab.ts";

// data/alias/<season>/<source_id>.json: the only place where a provider's ids
// live (SPEC-004 N-1, SPEC-005 N-3). The adapter owns and reads it.
export const AliasEntry = z.strictObject({
  externalId: z.string().min(1),
  externalName: z.string().min(1),
  teamId: TeamId,
});
export type AliasEntry = z.infer<typeof AliasEntry>;

export const AliasFile = z.strictObject({
  source: SourceId,
  season: Season,
  teams: z.array(AliasEntry),
  // Provider match id -> derived MatchId, written by calendario:sync (CA-3).
  matches: z.record(z.string().min(1), MatchId).optional(),
});
export type AliasFile = z.infer<typeof AliasFile>;

import { z } from "zod";
import type { Match } from "./entities.ts";
import { CompetitionId, MatchId, SourceId, type TeamId } from "./ids.ts";
import { Instant } from "./instant.ts";
import { MatchState } from "./state.ts";

// The SourceAdapter contract of ADR-003 as types and schemas (SPEC-005 CA-1).
// No implementation lives here: adapters live in src/sources/<id>/.

// What the core hands a pull adapter: only the matches inside their window.
export type WindowMatch = Pick<
  Match,
  "id" | "competitionId" | "season" | "kickoff" | "homeTeamId" | "awayTeamId"
>;

// No secrets and no external ids (N-3): the adapter owns its alias and gets
// its key at construction time (N-6).
export type FetchContext = {
  now: Instant;
  competitions: CompetitionId[];
  matches: WindowMatch[];
  fetch: typeof fetch;
  userAgent: string;
};

// One request of a capture: the body is text, never interpreted; the url
// never carries secrets.
export const RawRequest = z.strictObject({
  url: z.url(),
  status: z.int(),
  contentType: z.string().nullable(),
  body: z.string(),
});
export type RawRequest = z.infer<typeof RawRequest>;

export const RawCapture = z.strictObject({
  sourceId: SourceId,
  capturedAt: Instant,
  requests: z.array(RawRequest),
});
export type RawCapture = z.infer<typeof RawCapture>;

// Keys the core adds to an Observation (N-1): a parsed observation must not
// carry them, so the adapter cannot claim an id, a source or a raw reference.
const coreOwned = {
  id: z.never().optional(),
  sourceId: z.never().optional(),
  receivedAt: z.never().optional(),
  rawRef: z.never().optional(),
};

// MatchState + matchId (+ observedAt when the source dates its data).
export const ParsedObservation = MatchState.and(
  z.object({
    matchId: MatchId,
    observedAt: Instant.optional(),
    ...coreOwned,
  }),
);
export type ParsedObservation = z.infer<typeof ParsedObservation>;

export const ExternalTeam = z.strictObject({
  externalId: z.string(),
  externalName: z.string(),
});
export type ExternalTeam = z.infer<typeof ExternalTeam>;

// Identity that did not resolve (RN-10): output, never an exception, so the
// core can open an unresolved_team Alert with the external names (N-2).
export const UnresolvedReason = z.enum([
  "unknown_competition",
  "unknown_team",
  "unknown_match",
  "inconsistent_alias",
]);
export type UnresolvedReason = z.infer<typeof UnresolvedReason>;

export const Unresolved = z.strictObject({
  reason: UnresolvedReason,
  externalCompetition: z.string().nullable(),
  externalMatchId: z.string().nullable(),
  home: ExternalTeam,
  away: ExternalTeam,
  status: z.string(),
});
export type Unresolved = z.infer<typeof Unresolved>;

// Recorded, not alerted (N-2).
export const SkippedReason = z.enum(["unsupported_status", "missing_score"]);
export type SkippedReason = z.infer<typeof SkippedReason>;

export const Skipped = z.strictObject({
  externalMatchId: z.string().nullable(),
  status: z.string(),
  reason: SkippedReason,
});
export type Skipped = z.infer<typeof Skipped>;

export const ParseResult = z.strictObject({
  observations: z.array(ParsedObservation),
  unresolved: z.array(Unresolved),
  skipped: z.array(Skipped),
});
export type ParseResult = z.infer<typeof ParseResult>;

export interface SourceAdapter {
  readonly id: SourceId;
  readonly kind: "pull" | "push";
  // pull: we ask. Network; receives only the matches in window.
  fetch?(ctx: FetchContext): Promise<RawCapture>;
  // Pure: JSON.parse of the raw bodies and nothing else.
  parse(raw: RawCapture): ParseResult;
  // push: a payload reaches us (EPIC-004).
  verify?(req: Request): Promise<boolean>;
  ingest?(payload: unknown): ParseResult;
  // Identity: reads the adapter's own alias; null when unresolved (RN-10).
  resolveTeam(external: string, competition: CompetitionId): TeamId | null;
}

// Priority bands (N-4): 1-49 providers, 50-99 federation, 100 the operator
// (RN-01; not in the registry until EPIC-004).
export const FEDERATION_PRIORITY = 50;
export const OPERATOR_PRIORITY = 100;

// One entry of src/sources/registry.ts (ADR-003, D-7): configuration, never
// code. legalBasis is only annotated; the code never evaluates it.
export const SourceConfig = z
  .strictObject({
    id: SourceId,
    kind: z.enum(["pull", "push"]),
    competitions: z.array(CompetitionId).min(1),
    priority: z.record(CompetitionId, z.int().min(1).max(99)),
    minIntervalSeconds: z.int().min(1),
    userAgent: z.string().min(1),
    legalBasis: z.string().min(1),
  })
  .superRefine((config, ctx) => {
    const covered = new Set<string>(config.competitions);
    for (const competition of Object.keys(config.priority)) {
      if (!covered.has(competition))
        ctx.addIssue({
          code: "custom",
          path: ["priority", competition],
          message: `priority for a competition not covered: ${competition}`,
        });
    }
    for (const competition of config.competitions) {
      if (!(competition in config.priority))
        ctx.addIssue({
          code: "custom",
          path: ["priority"],
          message: `missing priority for ${competition}`,
        });
    }
  });
export type SourceConfig = z.infer<typeof SourceConfig>;

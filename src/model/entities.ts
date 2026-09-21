import { z } from "zod";
import {
  AlertId,
  CompetitionId,
  DecisionId,
  MatchId,
  ObservationId,
  SourceId,
  TeamId,
} from "./ids.ts";
import { Instant } from "./instant.ts";
import { MatchState } from "./state.ts";
import { AlertKind, DecisionRule, Qualifier, Season } from "./vocab.ts";

export const Competition = z.object({
  id: CompetitionId,
  season: Season,
  name: z.string().min(1),
  tier: z.int().min(1).max(5),
});
export type Competition = z.infer<typeof Competition>;

export const Team = z.object({
  id: TeamId,
  name: z.string().min(1),
});
export type Team = z.infer<typeof Team>;

export const Match = z
  .object({
    id: MatchId,
    competitionId: CompetitionId,
    season: Season,
    round: z.int().min(1),
    kickoff: Instant,
    homeTeamId: TeamId,
    awayTeamId: TeamId,
  })
  .refine((m) => m.homeTeamId !== m.awayTeamId, {
    message: "home and away must differ",
    path: ["awayTeamId"],
  });
export type Match = z.infer<typeof Match>;

export const Observation = MatchState.and(
  z.object({
    id: ObservationId,
    matchId: MatchId,
    sourceId: SourceId,
    observedAt: Instant,
    receivedAt: Instant,
    rawRef: z.string().min(1),
  }),
);
export type Observation = z.infer<typeof Observation>;

export const Decision = MatchState.and(
  z.object({
    id: DecisionId,
    matchId: MatchId,
    version: z.int().min(1),
    qualifier: Qualifier,
    rule: DecisionRule,
    observationIds: z.array(ObservationId).min(1),
    decidedAt: Instant,
  }),
).refine((d) => d.qualifier !== "sen_sinal" || d.status === "live", {
  message: "sen_sinal only applies to live matches",
  path: ["qualifier"],
});
export type Decision = z.infer<typeof Decision>;

export const Alert = z
  .object({
    id: AlertId,
    kind: AlertKind,
    matchId: MatchId.nullable(),
    openedAt: Instant,
    resolvedAt: Instant.nullable(),
    details: z.record(z.string(), z.unknown()),
  })
  .refine((a) => a.kind === "unresolved_team" || a.matchId !== null, {
    message: "only unresolved_team alerts may lack a match",
    path: ["matchId"],
  });
export type Alert = z.infer<typeof Alert>;

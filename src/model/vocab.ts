import { z } from "zod";

export const MatchStatus = z.enum([
  "scheduled",
  "live",
  "finished",
  "postponed",
  "suspended",
]);
export type MatchStatus = z.infer<typeof MatchStatus>;

export const Qualifier = z.enum(["confirmado", "provisional", "sen_sinal"]);
export type Qualifier = z.infer<typeof Qualifier>;

// Only the deciding rules of reglas.md (ADR-004): RN-04 never publishes, RN-06 records.
export const DecisionRule = z.enum([
  "operator",
  "RN-01",
  "RN-02",
  "RN-03",
  "RN-05",
]);
export type DecisionRule = z.infer<typeof DecisionRule>;

// forced_finish (SPEC-007 H-5): RN-02 closes a match nobody confirmed, and
// never in silence. The operator resolves it (EPIC-004); the engine never does.
export const AlertKind = z.enum([
  "conflict",
  "regression",
  "silence",
  "forced_finish",
  "unresolved_team",
]);
export type AlertKind = z.infer<typeof AlertKind>;

export const Season = z.string().regex(/^\d{4}-\d{2}$/);
export type Season = z.infer<typeof Season>;

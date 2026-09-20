import { z } from "zod";

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

export const CompetitionId = slug.brand<"CompetitionId">();
export type CompetitionId = z.infer<typeof CompetitionId>;

export const TeamId = slug.brand<"TeamId">();
export type TeamId = z.infer<typeof TeamId>;

export const SourceId = slug.brand<"SourceId">();
export type SourceId = z.infer<typeof SourceId>;

// Derived from the declared calendar; its shape is fixed by the calendar spec.
export const MatchId = z.string().min(1).brand<"MatchId">();
export type MatchId = z.infer<typeof MatchId>;

export const ObservationId = z.uuid().brand<"ObservationId">();
export type ObservationId = z.infer<typeof ObservationId>;

export const DecisionId = z.uuid().brand<"DecisionId">();
export type DecisionId = z.infer<typeof DecisionId>;

export const AlertId = z.uuid().brand<"AlertId">();
export type AlertId = z.infer<typeof AlertId>;

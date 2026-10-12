import { z } from "zod";
import { TeamId } from "./ids.ts";

// data/galegos/<season>.json (SPEC-033 CA-4, H-3): the TeamIds declared as
// Equipo galego for the season. A list, each id once; corrected by editing it.
export const GalicianTeamsFile = z
  .array(TeamId)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "duplicate TeamId",
  });
export type GalicianTeamsFile = z.infer<typeof GalicianTeamsFile>;

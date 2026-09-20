import { z } from "zod";

// ISO-8601 in UTC with a trailing Z; never a Date, never an offset.
export const Instant = z.iso.datetime();
export type Instant = z.infer<typeof Instant>;

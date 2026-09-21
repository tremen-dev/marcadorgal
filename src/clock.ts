import type { Instant } from "./model/index.ts";

// The edge of the system and the only place that reads the wall clock: now
// travels from here as an Instant (ADR-008 §7). Nothing under src/ingest/ or
// src/raw/ ever asks what time it is, so the whole core is testable with a
// given instant.
export const nowInstant = (): Instant => new Date().toISOString();

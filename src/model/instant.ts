import { z } from "zod";

// ISO-8601 in UTC with a trailing Z; never a Date, never an offset.
export const Instant = z.iso.datetime();
export type Instant = z.infer<typeof Instant>;

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

// Pure arithmetic over an Instant: the only place where a Date exists, and
// only as a formatter. The clock is never read here (ADR-008 §7), so the
// ingest core can offset an instant it was given without a Date of its own.
export function shiftInstant(instant: Instant, milliseconds: number): Instant {
  return new Date(Date.parse(instant) + milliseconds).toISOString();
}

// Milliseconds from a to b, positive when b is later.
export function instantDiff(a: Instant, b: Instant): number {
  return Date.parse(b) - Date.parse(a);
}

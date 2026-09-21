// Every number of the ingest core, with the rule that fixes it.

// Window of a match (ADR-002 §2): ten minutes before kickoff and two hours
// and a half after it, which covers stoppage time and a long interruption.
export const WINDOW_BEFORE_MINUTES = 10;
export const WINDOW_AFTER_MINUTES = 150;

// Cadence (RN-08, ADR-008 §3): the registry declares 30 s, and the guard
// tolerates the jitter of the two triggers. Worst case: two calls 25 s apart.
export const CADENCE_JITTER_SECONDS = 5;

// Raw retention (D-6, ADR-007 §5): thirty days, purged by the tick itself at
// most once a day, retried an hour after a failure, a thousand keys per call.
export const RAW_RETENTION_DAYS = 30;
export const PURGE_EVERY_HOURS = 24;
export const PURGE_RETRY_HOURS = 1;
export const PURGE_BATCH = 1000;

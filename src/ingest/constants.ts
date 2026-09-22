// Every number of the ingest core, with the rule that fixes it.

// Window of a match (ADR-002 §2): ten minutes before kickoff and two hours
// and a half after it, which covers stoppage time and a long interruption.
export const WINDOW_BEFORE_MINUTES = 10;
export const WINDOW_AFTER_MINUTES = 150;

// Cadence (RN-08, ADR-008 §3): the registry declares 30 s, and the guard
// tolerates the jitter of the two triggers. Worst case: two calls 25 s apart.
export const CADENCE_JITTER_SECONDS = 5;

// The traffic light of npm run tick:salud (CA-7, N-5). The verdict is decided
// on a short window and not on the whole hour: a blip at 18:00 fixed at 18:10
// would otherwise keep the report red until 19:00, and a semaphore nobody
// believes is a semaphore nobody looks at. Ten minutes is ~20 runs of a job
// that fires every 30 s —enough that a healthy tick shows up— and it is
// shorter than the fifteen minutes of RN-05, so the report turns red before
// the engine starts opening silence alerts. The hour stays on screen as
// context, with at most five failures listed and a count for the rest: the
// whole report has to fit in one screen while a matchday is running.
export const SALUD_RECENT_MINUTES = 10;
export const SALUD_FAILURES_SHOWN = 5;

// A run pg_cron has not finished yet is neither a success nor a failure: it
// is still going (SPEC-010 CA-1). These are the four non terminal statuses of
// pg_cron, and a tick sent through pg_net passes through sending and
// connecting before it can succeed; with the job firing every 30 s, catching
// one in flight is the normal case and not an edge one, so counting it as a
// failure turned the traffic light red for no reason. The rule is written as
// the list of statuses in flight and not as the list of failing ones on
// purpose: a status pg_cron adds tomorrow that we do not know about has to
// keep coming out red, which is the conservative direction.
export const SALUD_IN_FLIGHT_STATUSES: readonly string[] = [
  "starting",
  "running",
  "sending",
  "connecting",
];

// Raw retention (D-6, ADR-007 §5): thirty days, purged by the tick itself at
// most once a day, retried an hour after a failure, a thousand keys per call.
export const RAW_RETENTION_DAYS = 30;
export const PURGE_EVERY_HOURS = 24;
export const PURGE_RETRY_HOURS = 1;
export const PURGE_BATCH = 1000;

import {
  HOUR_MS,
  type Instant,
  MINUTE_MS,
  shiftInstant,
} from "../model/index.ts";
import {
  SALUD_FAILURES_SHOWN,
  SALUD_IN_FLIGHT_STATUSES,
  SALUD_RECENT_MINUTES,
} from "./constants.ts";

// The tool of the Friday (N-5): it says whether the tick is alive before
// there is any match to observe, which is when it can still be fixed. Pure:
// it receives rows and gives back the text and a verdict; tools/tick-salud.mjs
// is the shell that queries and prints it.

export type SaludJob = { jobname: string; schedule: string; active: boolean };
export type SaludRun = {
  jobname: string;
  status: string;
  startTime: Instant;
};
export type SaludResponse = { statusCode: number | null; created: Instant };
export type SaludAttempt = {
  startedAt: Instant;
  sourceId: string;
  ok: boolean | null;
  error: string | null;
  details: unknown;
};
export type SaludAlert = { kind: string; count: number };
export type SaludMatch = { id: string; kickoff: Instant; status: string };

export type SaludInput = {
  now: Instant;
  // Values that must never reach the output, whatever row carried them.
  secrets: readonly string[];
  jobs: readonly SaludJob[];
  runs: readonly SaludRun[];
  responses: readonly SaludResponse[];
  attempts: readonly SaludAttempt[];
  alerts: readonly SaludAlert[];
  matches: readonly SaludMatch[];
};

export type SaludReport = { ok: boolean; text: string };

export const REDACTED = "[secreto]";

// A secret may come back inside an error or inside details: it is replaced
// wherever it shows up, so the report can be pasted into a ledger.
function redact(text: string, secrets: readonly string[]): string {
  let out = text;
  for (const secret of secrets) {
    if (secret.length === 0) continue;
    out = out.split(secret).join(REDACTED);
  }
  return out;
}

const list = (lines: string[]): string[] =>
  lines.length === 0 ? ["  (ninguna)"] : lines;

const percent = (part: number, total: number): string =>
  total === 0 ? "n/a" : `${Math.round((part / total) * 100)}%`;

// A run that has not finished yet is neither a success nor a failure: it is
// still going (SPEC-010 CA-1).
const inFlight = (run: SaludRun): boolean =>
  SALUD_IN_FLIGHT_STATUSES.includes(run.status);

// The window lines say how many runs are terminal, because the percentage is
// over those, and name the ones in flight when there are any: without it,
// twenty succeeded plus one running would read 100% of twenty-one (CA-2).
const inFlightNote = (all: number, terminals: number): string =>
  all === terminals ? "" : `  ·  en vuelo: ${all - terminals}`;

const detailsOf = (details: unknown): string =>
  details === null || details === undefined
    ? ""
    : ` ${JSON.stringify(details)}`;

export function tickSalud(input: SaludInput): SaludReport {
  const since = shiftInstant(input.now, -HOUR_MS);
  // The short window decides the verdict; the hour is only context.
  const recentSince = shiftInstant(
    input.now,
    -SALUD_RECENT_MINUTES * MINUTE_MS,
  );

  const runs = input.runs.filter((r) => r.startTime >= since);
  // A run in flight leaves the failure list and the percentage, but it stays
  // in the block of statuses: the row is seen, it just stops being counted.
  const terminal = runs.filter((r) => !inFlight(r));
  // Newest first, so the five that get printed are the five that matter.
  const failed = terminal
    .filter((r) => r.status !== "succeeded")
    .toSorted((a, b) => (a.startTime < b.startTime ? 1 : -1));
  // Silence is measured over every recent row, terminal or not: pg_cron fired,
  // which is what the third reason to be red watches. Filtering the runs in
  // flight out here would turn a lone running into "no runs at all" and give
  // the same false REVISAR back through the other door (CA-3).
  const recentRuns = runs.filter((r) => r.startTime >= recentSince);
  const recentTerminal = recentRuns.filter((r) => !inFlight(r));
  const failedRecent = recentTerminal.filter((r) => r.status !== "succeeded");

  const broken = input.attempts.filter(
    (a) => a.ok === false && a.startedAt >= since,
  );
  const brokenRecent = broken.filter((a) => a.startedAt >= recentSince);

  const out: string[] = [`tick:salud · ${input.now}`, ""];

  out.push("jobs de pg_cron:");
  out.push(
    ...list(
      input.jobs.map(
        (j) =>
          `  ${j.jobname}  ${j.schedule}  ${j.active ? "activo" : "INACTIVO"}`,
      ),
    ),
  );

  out.push(
    "",
    `ejecuciones (últimos ${SALUD_RECENT_MINUTES} min): ${recentRuns.length}` +
      `  ·  terminales: ${recentTerminal.length}` +
      `  ·  succeeded: ${percent(recentTerminal.length - failedRecent.length, recentTerminal.length)}` +
      inFlightNote(recentRuns.length, recentTerminal.length) +
      "   ← decide el semáforo",
  );
  out.push(
    `ejecuciones (última hora): ${runs.length}` +
      `  ·  terminales: ${terminal.length}` +
      `  ·  succeeded: ${percent(terminal.length - failed.length, terminal.length)}` +
      inFlightNote(runs.length, terminal.length),
  );
  const byStatus = new Map<string, number>();
  for (const run of runs)
    byStatus.set(run.status, (byStatus.get(run.status) ?? 0) + 1);
  out.push(
    ...list([...byStatus].map(([status, count]) => `  ${status}: ${count}`)),
  );
  // At most five, newest first: a ten minute outage used to print a hundred
  // identical lines and bury the blocks that matter.
  for (const run of failed.slice(0, SALUD_FAILURES_SHOWN))
    out.push(`  FALLO  ${run.startTime}  ${run.jobname}  ${run.status}`);
  const hidden = failed.length - SALUD_FAILURES_SHOWN;
  if (hidden > 0) out.push(`  … y ${hidden} más`);

  out.push("", "respuestas de pg_net (últimas 10):");
  out.push(
    ...list(
      input.responses.map(
        (r) => `  ${r.created}  ${r.statusCode ?? "sin código"}`,
      ),
    ),
  );

  out.push("", "intentos de ingesta (últimos 10):");
  out.push(
    ...list(
      input.attempts.map(
        (a) =>
          `  ${a.startedAt}  ${a.sourceId}  ${a.ok === null ? "abierto" : a.ok ? "ok" : "FALLO"}` +
          `${a.error === null ? "" : `  ${a.error}`}${detailsOf(a.details)}`,
      ),
    ),
  );

  out.push("", "alertas sin resolver:");
  out.push(...list(input.alerts.map((a) => `  ${a.kind}: ${a.count}`)));

  out.push("", `partidos en ventana: ${input.matches.length}`);
  out.push(
    ...list(input.matches.map((m) => `  ${m.kickoff}  ${m.status}  ${m.id}`)),
  );

  // The third reason to be red (CA-7 (c), N-6): a pg_cron that stopped firing
  // is the gravest and likeliest failure, and without this it looked exactly
  // like a healthy system — full report, OK, exit 0. Only an empty cron.job is
  // innocent: that is a brand new database, where nothing is scheduled and so
  // nothing is expected. A job that is there but switched off is red all the
  // same, because a tick turned off by hand is not a new database.
  const silent = input.jobs.length > 0 && recentRuns.length === 0;
  const anyActive = input.jobs.some((j) => j.active);

  // The verdict is about now, not about the hour: what is already fixed does
  // not keep the light red, but it is still said out loud.
  const ok = failedRecent.length === 0 && brokenRecent.length === 0 && !silent;
  const stale = failed.length + (broken.length - brokenRecent.length);
  out.push("", ok ? "OK" : "REVISAR: el tick no está sano");
  // A red light with no reason sends you digging.
  if (silent)
    out.push(
      anyActive
        ? `  sin ejecuciones en los últimos ${SALUD_RECENT_MINUTES} min habiendo un job activo`
        : `  sin ejecuciones en los últimos ${SALUD_RECENT_MINUTES} min y ningún job activo: el tick está INACTIVO`,
    );
  if (ok && stale > 0)
    out.push(
      `  (${stale} problema(s) en la última hora, ninguno en los últimos ${SALUD_RECENT_MINUTES} min)`,
    );

  return { ok, text: redact(out.join("\n"), input.secrets) };
}

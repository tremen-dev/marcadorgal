import { HOUR_MS, type Instant, shiftInstant } from "../model/index.ts";

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

const detailsOf = (details: unknown): string =>
  details === null || details === undefined
    ? ""
    : ` ${JSON.stringify(details)}`;

export function tickSalud(input: SaludInput): SaludReport {
  const since = shiftInstant(input.now, -HOUR_MS);
  const runs = input.runs.filter((r) => r.startTime >= since);
  const failed = runs.filter((r) => r.status !== "succeeded");
  const attempts = input.attempts.filter((a) => a.startedAt >= since);
  const broken = attempts.filter((a) => a.ok === false);

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

  out.push("", `ejecuciones (última hora): ${runs.length}`);
  const byStatus = new Map<string, number>();
  for (const run of runs)
    byStatus.set(run.status, (byStatus.get(run.status) ?? 0) + 1);
  out.push(
    ...list([...byStatus].map(([status, count]) => `  ${status}: ${count}`)),
  );
  out.push(`  succeeded: ${percent(runs.length - failed.length, runs.length)}`);
  for (const run of failed)
    out.push(`  FALLO  ${run.startTime}  ${run.jobname}  ${run.status}`);

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

  const ok = failed.length === 0 && broken.length === 0;
  out.push("", ok ? "OK" : "REVISAR: el tick no está sano");

  return { ok, text: redact(out.join("\n"), input.secrets) };
}

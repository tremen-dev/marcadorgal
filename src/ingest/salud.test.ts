import { describe, expect, it } from "vitest";
import { type Instant, MINUTE_MS, shiftInstant } from "@/model";
import { type SaludInput, tickSalud } from "./salud.ts";

const NOW = "2026-09-25T18:40:00.000Z" as Instant;
const at = (minutes: number) => shiftInstant(NOW, minutes * MINUTE_MS);
const TOKEN = "0123456789abcdef0123456789abcdef";

const clean = (over: Partial<SaludInput> = {}): SaludInput => ({
  now: NOW,
  secrets: [TOKEN],
  jobs: [{ jobname: "ingest-tick", schedule: "30 seconds", active: true }],
  runs: [
    { jobname: "ingest-tick", status: "succeeded", startTime: at(-1) },
    { jobname: "ingest-tick", status: "succeeded", startTime: at(-2) },
  ],
  responses: [{ statusCode: 200, created: at(-1) }],
  attempts: [
    {
      startedAt: at(-1),
      sourceId: "api-football",
      ok: true,
      error: null,
      details: { matches: 3 },
    },
  ],
  alerts: [{ kind: "silence", count: 2 }],
  matches: [
    {
      id: "primera-division-2026-27-j6-celta-deportivo",
      kickoff: NOW,
      status: "live",
    },
  ],
  ...over,
});

const BLOCKS = [
  "jobs de pg_cron",
  "ejecuciones",
  "respuestas de pg_net",
  "intentos de ingesta",
  "alertas sin resolver",
  "partidos en ventana",
];

describe("SPEC-008 CA-7 tickSalud", () => {
  it("a clean hour is ok and prints the six blocks", () => {
    const report = tickSalud(clean());
    expect(report.ok).toBe(true);
    for (const block of BLOCKS) expect(report.text).toContain(block);
    expect(report.text).toContain("100%");
  });

  it("a failed run in the last hour turns it red, naming the job", () => {
    const report = tickSalud(
      clean({
        runs: [
          { jobname: "ingest-tick", status: "failed", startTime: at(-3) },
          { jobname: "ingest-tick", status: "succeeded", startTime: at(-1) },
        ],
      }),
    );
    expect(report.ok).toBe(false);
    expect(report.text).toContain("ingest-tick");
    expect(report.text).toContain("failed");
  });

  it("ignores a failed run older than an hour", () => {
    const report = tickSalud(
      clean({
        runs: [
          { jobname: "ingest-tick", status: "failed", startTime: at(-90) },
        ],
      }),
    );
    expect(report.ok).toBe(true);
  });

  it("an attempt with ok false turns it red, with its error", () => {
    const report = tickSalud(
      clean({
        attempts: [
          {
            startedAt: at(-2),
            sourceId: "api-football",
            ok: false,
            error: "no alias for api-football 2026-27",
            details: null,
          },
        ],
      }),
    );
    expect(report.ok).toBe(false);
    expect(report.text).toContain("no alias for api-football 2026-27");
  });

  it("with no row anywhere it still prints the six blocks", () => {
    const report = tickSalud({
      now: NOW,
      secrets: [],
      jobs: [],
      runs: [],
      responses: [],
      attempts: [],
      alerts: [],
      matches: [],
    });
    expect(report.ok).toBe(true);
    for (const block of BLOCKS) expect(report.text).toContain(block);
  });

  it("never prints a secret, not even one that came in a row", () => {
    const report = tickSalud(
      clean({
        attempts: [
          {
            startedAt: at(-2),
            sourceId: "api-football",
            ok: false,
            error: `401 with Bearer ${TOKEN}`,
            details: { header: `Bearer ${TOKEN}` },
          },
        ],
      }),
    );
    expect(report.text).not.toContain(TOKEN);
    expect(report.text).toContain("[secreto]");
  });
});

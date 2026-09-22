import { describe, expect, it } from "vitest";
import { type Instant, MINUTE_MS, shiftInstant } from "@/model";
import { SILENCE_MINUTES } from "../decide/index.ts";
import { SALUD_RECENT_MINUTES } from "./constants.ts";
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

  it("a failed run inside the short window turns it red, naming the job", () => {
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
    // The short window has to be clean AND alive: since N-6 an active job
    // with nothing in the last ten minutes is red on its own, so the recent
    // succeeded runs are part of what "clean" means now.
    const report = tickSalud(
      clean({
        runs: [
          { jobname: "ingest-tick", status: "failed", startTime: at(-90) },
          { jobname: "ingest-tick", status: "succeeded", startTime: at(-2) },
          { jobname: "ingest-tick", status: "succeeded", startTime: at(-1) },
        ],
      }),
    );
    expect(report.ok).toBe(true);
    // Older than the hour: it is not even counted as a stale problem.
    expect(report.text).not.toContain("problema(s) en la última hora");
  });

  // The two pegas found when running step 5 of the start-up (F-SPEC-008-13).
  it("stays green when the hour had failures but the short window is clean", () => {
    // The blip at -30 min is over; the last ten minutes are all succeeded.
    const report = tickSalud(
      clean({
        runs: [
          { jobname: "ingest-tick", status: "failed", startTime: at(-30) },
          { jobname: "ingest-tick", status: "failed", startTime: at(-29) },
          { jobname: "ingest-tick", status: "succeeded", startTime: at(-2) },
          { jobname: "ingest-tick", status: "succeeded", startTime: at(-1) },
        ],
      }),
    );
    expect(report.ok).toBe(true);
    // The hour stays on screen, and the report says so out loud.
    expect(report.text).toContain("última hora");
    expect(report.text).toContain("2 problema(s) en la última hora");
    expect(report.text).toContain("OK");
  });

  it("an attempt that failed before the short window no longer holds it red", () => {
    const report = tickSalud(
      clean({
        attempts: [
          {
            startedAt: at(-40),
            sourceId: "api-football",
            ok: false,
            error: "provider 503",
            details: null,
          },
        ],
      }),
    );
    expect(report.ok).toBe(true);
    // Still visible in its own block: green does not mean hidden.
    expect(report.text).toContain("provider 503");
  });

  it("caps the list of failures and counts the rest", () => {
    const runs = Array.from({ length: 40 }, (_, i) => ({
      jobname: "ingest-tick",
      status: "failed",
      startTime: at(-50 + i),
    }));
    const report = tickSalud(clean({ runs }));
    const lines = report.text
      .split("\n")
      .filter((line) => line.includes("FALLO"));
    expect(lines).toHaveLength(5);
    expect(report.text).toContain("y 35 más");
    // Newest first: the five printed are the five that matter.
    expect(lines[0]).toContain(at(-11));
    expect(lines[4]).toContain(at(-15));
    // The whole report still fits on a screen.
    expect(report.text.split("\n").length).toBeLessThan(40);
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

  // Case 7 of CA-7: the brand new database. This is the one case that (c)
  // has to keep green, and the one a lazy implementation of (c) breaks.
  it("with no row anywhere, and an empty cron.job, it is a new database and not a dead tick", () => {
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

  // Cases 5, 6 and 8 of CA-7 (N-6): a pg_cron that stopped firing used to look
  // exactly like a healthy system. Silence is red now.
  it("an active job with no run in the short window is red, and says why", () => {
    const report = tickSalud(
      clean({
        jobs: [
          { jobname: "ingest-tick", schedule: "30 seconds", active: true },
        ],
        runs: [],
        attempts: [],
      }),
    );
    // Not one failure anywhere, and still red.
    expect(report.ok).toBe(false);
    expect(report.text).toContain(
      `sin ejecuciones en los últimos ${SALUD_RECENT_MINUTES} min`,
    );
    expect(report.text).toContain("job activo");
  });

  it("a job that stopped firing eleven minutes ago is red, with the hour still full", () => {
    // How a pg_cron that dies mid-matchday really looks: the hour is full of
    // succeeded runs and the short window is empty. A check on runs.length
    // alone would call this healthy.
    const runs = Array.from({ length: 20 }, (_, i) => ({
      jobname: "ingest-tick",
      status: "succeeded",
      startTime: at(-11 - i),
    }));
    const report = tickSalud(clean({ runs, attempts: [] }));
    expect(runs.length).toBeGreaterThan(0);
    expect(report.ok).toBe(false);
    expect(report.text).toContain(
      `sin ejecuciones en los últimos ${SALUD_RECENT_MINUTES} min`,
    );
    // The context is still on screen: the hour was healthy until it was not.
    expect(report.text).toContain("ejecuciones (última hora): 20");
  });

  it("a job switched off by hand is red too, not a new database", () => {
    const report = tickSalud(
      clean({
        jobs: [
          { jobname: "ingest-tick", schedule: "30 seconds", active: false },
        ],
        runs: [],
        attempts: [],
      }),
    );
    expect(report.ok).toBe(false);
    expect(report.text).toContain("INACTIVO");
  });
});

describe("SPEC-008 CA-7 the short window is shorter than the silence rule", () => {
  it("stays under SILENCE_MINUTES, which is why ten was chosen", () => {
    // Nobody may raise the window past RN-05 without this failing: the whole
    // point of ten minutes is that the traffic light goes red before the
    // engine starts opening silence alerts.
    expect(SALUD_RECENT_MINUTES).toBeLessThan(SILENCE_MINUTES);
  });
});

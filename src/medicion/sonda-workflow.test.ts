import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// SPEC-025 CA-3 (H-2): the workflow of the probe. Read as text: the project
// has no YAML dependency and CA-7 forbids adding one; the assertions anchor on
// the lines' indentation, so a comment cannot satisfy them.
const yml = readFileSync(
  new URL("../../.github/workflows/sonda-pantalla.yml", import.meta.url),
  "utf8",
);
const lines = yml.split("\n").filter((l) => !l.trimStart().startsWith("#"));
const code = lines.join("\n");

describe("SPEC-025 CA-3 sonda-pantalla.yml", () => {
  it("runs on schedule and on workflow_dispatch with an `horas` input", () => {
    expect(lines).toContain("  schedule:");
    expect(lines).toContain("  workflow_dispatch:");
    expect(lines).toContain("      horas:");
  });

  it("schedules only the blocks of the matchday 2026-10-16/19 (N-2)", () => {
    const crons = [...code.matchAll(/- cron: '([^']+)'/g)].map((m) => m[1]);
    expect(crons.length).toBeGreaterThan(0);
    for (const cron of crons) {
      const [, , day, month] = cron.split(" ");
      expect(month).toBe("10");
      expect(Number(day)).toBeGreaterThanOrEqual(16);
      expect(Number(day)).toBeLessThanOrEqual(19);
    }
  });

  it("stays inside a job's 6 h and never asks for more than 5.5 h", () => {
    const timeout = Number(/timeout-minutes: (\d+)/.exec(code)?.[1]);
    expect(timeout).toBeLessThanOrEqual(360);
    const hours = [...code.matchAll(/horas=([\d.]+)/g)].map((m) =>
      Number(m[1]),
    );
    expect(hours.length).toBeGreaterThan(0);
    for (const h of hours) expect(h).toBeLessThanOrEqual(5.5);
  });

  it("uses no secret and only reads https://marcador.gal", () => {
    expect(code).not.toMatch(/secrets\./);
    expect(code).toMatch(/--url https:\/\/marcador\.gal\n/);
    expect(lines).toContain("  contents: read");
  });

  it("uploads the JSONL as an artifact, even when the job is cut", () => {
    expect(code).toMatch(
      /uses: actions\/upload-artifact@v4\n\s+if: always\(\)/,
    );
    expect(code).toMatch(/path: sonda\//);
  });
});

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { decide } from "../decide/engine.ts";

// SPEC-007 CA-12. The engine is pure (ADR-004, N-2): it knows the model and
// itself, and nothing else. No database, no clock, no network, no filesystem.

const root = path.resolve(__dirname, "../..");
const MODEL_DIR = "src/model";
const DECIDE_DIR = "src/decide";

type Violation = { file: string; specifier: string; reason: string };

const within = (resolved: string, dir: string) =>
  resolved === dir || resolved.startsWith(`${dir}/`);

export function checkDecideImports(file: string, source: string): Violation[] {
  const posix = file.split(path.sep).join(path.posix.sep);
  const violations: Violation[] = [];
  for (const { fileName: specifier } of ts.preProcessFile(source, true, true)
    .importedFiles) {
    if (specifier === "zod") continue;
    if (specifier.startsWith(".")) {
      const resolved = path.posix.join(path.posix.dirname(posix), specifier);
      if (within(resolved, MODEL_DIR) || within(resolved, DECIDE_DIR)) continue;
      violations.push({
        file,
        specifier,
        reason: `a relative import must stay inside ${MODEL_DIR}/ or ${DECIDE_DIR}/`,
      });
      continue;
    }
    violations.push({
      file,
      specifier,
      reason: "only zod and relative imports of the model or the engine",
    });
  }
  return violations;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return name.endsWith(".ts") ? [full] : [];
  });
}

const sources = walk(path.join(root, DECIDE_DIR)).map((abs) => ({
  file: path.relative(root, abs).split(path.sep).join(path.posix.sep),
  source: readFileSync(abs, "utf8"),
}));

describe("CA-12 checkDecideImports", () => {
  const file = "src/decide/engine.ts";

  it("accepts zod and relative imports of the model and the engine", () => {
    expect(
      checkDecideImports(
        file,
        `import { z } from "zod";
         import { MatchState } from "../model/index.ts";
         import { SILENCE_MINUTES } from "./thresholds.ts";`,
      ),
    ).toEqual([]);
  });

  it.each([
    `import postgres from "postgres";`,
    `import { readFileSync } from "node:fs";`,
    `import { NextResponse } from "next/server";`,
    `import { sql } from "@/db/client";`,
    `import { MatchState } from "@/model";`,
    `import { decideMatches } from "../ingest/engine.ts";`,
    `import { SOURCES } from "../sources/registry.ts";`,
    `const p = await import("postgres");`,
  ])("flags %s", (source) => {
    const violations = checkDecideImports(file, source);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ file });
  });
});

describe("CA-12 the real src/decide tree", () => {
  it("has files to check", () => {
    expect(sources.length).toBeGreaterThan(3);
  });

  it("imports nothing but the model, itself and zod", () => {
    const violations = sources
      .filter(({ file }) => !file.endsWith(".test.ts"))
      .flatMap(({ file, source }) => checkDecideImports(file, source));
    expect(violations).toEqual([]);
  });

  // The clock, randomness, uuids and the network are outside the engine: the
  // tests too, so the replay is reproducible.
  it.each(["new Date(", "Date.now(", "Math.random(", "crypto.", "fetch("])(
    "never writes %s",
    (needle) => {
      expect(
        sources
          .filter(({ source }) => source.includes(needle))
          .map((s) => s.file),
      ).toEqual([]);
    },
  );
});

describe("CA-12 decide is a function of its input", () => {
  it("answers the same twice", () => {
    const input = {
      match: {
        id: "primera-division-2026-27-j6-celta-deportivo",
        competitionId: "primera-division",
        kickoff: "2026-09-25T18:30:00.000Z",
      },
      current: null,
      observations: [],
      priority: () => 10,
      now: "2026-09-25T19:30:00.000Z",
    } as unknown as Parameters<typeof decide>[0];
    expect(decide(input)).toEqual(decide(input));
  });
});

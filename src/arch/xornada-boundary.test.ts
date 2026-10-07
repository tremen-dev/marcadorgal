import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkXornadaImports } from "./xornada-boundary";

const file = "src/xornada/view.ts";

describe("SPEC-019 CA-2 checkXornadaImports", () => {
  it("accepts zod, @/model, model-relative and same-folder imports", () => {
    const src = `
import { z } from "zod";
import type { PublicMatch } from "@/model";
import { Instant } from "@/model/instant";
import { MatchState } from "../model/state";
import { DEMO } from "./demo";
`;
    expect(checkXornadaImports(file, src)).toEqual([]);
  });

  it("accepts vitest only in test files", () => {
    const src = `import { it } from "vitest";`;
    expect(checkXornadaImports("src/xornada/view.test.ts", src)).toEqual([]);
    expect(checkXornadaImports(file, src)).toHaveLength(1);
  });

  it.each([
    `import { t } from "@/i18n";`,
    `import { now } from "@/clock";`,
    `import { sql } from "@/db/client";`,
    `import React from "react";`,
    `import { notFound } from "next/navigation";`,
    `import { readFileSync } from "node:fs";`,
    `import { decide } from "../decide/engine";`,
    `import data from "../../data/calendario/2026-27/primera-division.json";`,
    `const p = await import("postgres");`,
  ])("flags %s", (src) => {
    const violations = checkXornadaImports(file, src);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ file });
  });
});

const root = path.resolve(__dirname, "../..");
const xornadaDir = path.join(root, "src/xornada");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("SPEC-019 CA-2 src/xornada tree", () => {
  it("src/xornada/**/*.{ts,tsx} only imports from src/model", () => {
    const files = walk(xornadaDir);
    expect(files.length).toBeGreaterThan(0);
    const violations = files.flatMap((abs) =>
      checkXornadaImports(path.relative(root, abs), readFileSync(abs, "utf8")),
    );
    expect(violations).toEqual([]);
  });
});

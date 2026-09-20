import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkSourceImports } from "./sources-boundary";

const adapter = `
import { z } from "zod";
import { readFileSync } from "node:fs";
import { MatchState } from "@/model";
import type { TeamId } from "@/model/ids";
import { Instant } from "../../model/instant";
import { parseRow } from "./parse";
import aliases from "./fixtures/aliases.json";
export const id = "acme";
`;

const file = "src/sources/acme/adapter.ts";

describe("CA-14 checkSourceImports", () => {
  it("accepts zod, node:, @/model, model-relative and same-folder imports", () => {
    expect(checkSourceImports(file, adapter)).toEqual([]);
  });

  it("accepts vitest only in test files", () => {
    const src = `import { it } from "vitest";`;
    expect(checkSourceImports("src/sources/acme/parse.test.ts", src)).toEqual(
      [],
    );
    expect(checkSourceImports(file, src)).toHaveLength(1);
  });

  it.each([
    `import postgres from "postgres";`,
    `import { NextResponse } from "next/server";`,
    `import { sql } from "@/db/client";`,
    `import { decide } from "../../decide/x";`,
    `import { readFileSync } from "fs";`,
    `import { other } from "../other/adapter";`,
    `export { x } from "@supabase/supabase-js";`,
    `const p = await import("postgres");`,
  ])("flags %s", (src) => {
    const violations = checkSourceImports(file, src);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ file });
  });
});

const root = path.resolve(__dirname, "../..");
const sourcesDir = path.join(root, "src/sources");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

const tree = existsSync(sourcesDir)
  ? "src/sources/**/*.{ts,tsx} has no violations"
  : "src/sources does not exist yet (empty tree: the rule is proven with in-memory fixtures)";

describe("CA-14 src/sources tree", () => {
  it(tree, () => {
    const files = existsSync(sourcesDir) ? walk(sourcesDir) : [];
    const violations = files.flatMap((abs) =>
      checkSourceImports(path.relative(root, abs), readFileSync(abs, "utf8")),
    );
    expect(violations).toEqual([]);
  });
});

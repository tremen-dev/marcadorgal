import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// SPEC-020 CA-4: one server-only module reads DATABASE_URL_PUBLIC, and it
// never reads DATABASE_URL (ADR-014 §4).
const root = path.resolve(__dirname, "../..");
const READER = "src/board/reader.ts";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx|mts|mjs)$/.test(name) ? [full] : [];
  });
}

const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const rel = (abs: string) => path.relative(root, abs).split(path.sep).join("/");

describe("SPEC-020 CA-4 the public reader", () => {
  it("is server-only", () => {
    expect(read(READER)).toMatch(/^import "server-only";/m);
  });

  it("reads DATABASE_URL_PUBLIC and never DATABASE_URL", () => {
    const src = read(READER);
    expect(src).toContain("process.env.DATABASE_URL_PUBLIC");
    expect(src).not.toMatch(/DATABASE_URL(?!_PUBLIC)/);
    expect(src).not.toMatch(/@\/db\/client|\.\.\/db\/client|createSql\b/);
  });

  it("is the only module of the code that reads DATABASE_URL_PUBLIC", () => {
    const files = [
      ...walk(path.join(root, "src")),
      ...walk(path.join(root, "tools")),
    ]
      .map(rel)
      .filter((f) => !/\.test\.tsx?$/.test(f));
    const readers = files.filter((f) =>
      read(f).includes("DATABASE_URL_PUBLIC"),
    );
    expect(readers).toEqual([READER]);
  });
});

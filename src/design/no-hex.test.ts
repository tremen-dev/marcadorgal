import { globSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import { describe, expect, it } from "vitest";

const HEX = /(?<![\w-])#[0-9a-fA-F]{3,8}\b/;
const ALLOWED = new Set(["src/design/tokens.ts", "src/design/tokens.css"]);

const sources = (): string[] =>
  globSync("src/**/*.{ts,tsx,css}")
    .map((file) => relative(process.cwd(), file))
    .sort();

describe("CA-12 no hex outside the tokens", () => {
  it("scans a non-trivial tree", () => {
    const files = sources();
    expect(files.length).toBeGreaterThan(10);
    expect(files).toContain("src/design/tokens.css");
    expect(files).toContain("src/components/xornada/Xornada.module.css");
  });

  it("no file other than tokens.ts/tokens.css contains a hex colour", () => {
    const offenders = sources()
      .filter((file) => !ALLOWED.has(file))
      .filter((file) => HEX.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});

// SPEC-020 CA-6: the waiting page left /; the screen that replaced it keeps
// the guarantee.
describe("CA-11 Xornada.module.css consumes tokens.css", () => {
  const css = readFileSync("src/components/xornada/Xornada.module.css", "utf8");
  const tokens = readFileSync("src/design/tokens.css", "utf8");
  const defined = new Set(
    [...tokens.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]),
  );

  it("every var(--…) it uses is defined in tokens.css", () => {
    const used = [...css.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((name) => !defined.has(name))).toEqual([]);
  });
});

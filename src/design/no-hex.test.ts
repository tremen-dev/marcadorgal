import { globSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import { describe, expect, it } from "vitest";

const HEX = /(?<![\w-])#[0-9a-fA-F]{3,8}\b/;
const ALLOWED = new Set(["src/design/tokens.ts", "src/design/tokens.css"]);

const sources = (): string[] =>
  globSync("src/**/*.{ts,tsx,css}")
    .map((file) => relative(process.cwd(), file).replaceAll("\\", "/"))
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

// SPEC-057 CA-6 (F-SPEC-057-7): no colour function in CSS outside tokens.css
// either; a veil or a shadow is a token of tokens.ts like any other colour.
const COLOR_FN = /(?<![\w-])(?:rgba?|hsla?)\(/;

describe("SPEC-057 CA-6 no rgb()/hsl() literal in CSS outside tokens.css", () => {
  it("no src/**/*.css but tokens.css contains rgb(, rgba(, hsl( or hsla(", () => {
    const offenders = sources()
      .filter((file) => file.endsWith(".css") && !ALLOWED.has(file))
      .filter((file) => COLOR_FN.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("the pattern catches the literals it is meant to", () => {
    for (const literal of ["rgba(0, 0, 0, 0.75)", "rgb(1 2 3)", "hsl(0 0% 0%)"])
      expect(COLOR_FN.test(`a { color: ${literal}; }`)).toBe(true);
    expect(COLOR_FN.test("a { color: var(--velo); }")).toBe(false);
  });
});

// SPEC-083 CA-3: nor in TypeScript; the colour of a league or a club is a
// token of tokens.ts, read through its CSS variable. Tests may name a literal.
const isTest = (file: string): boolean => /\.test\.tsx?$/.test(file);

describe("SPEC-083 CA-3 no rgb()/hsl() literal in TS outside tokens.ts", () => {
  it("no src/**/*.{ts,tsx} but tokens.ts and the tests contains rgb(, rgba(, hsl( or hsla(", () => {
    const offenders = sources()
      .filter((file) => /\.tsx?$/.test(file))
      .filter((file) => !ALLOWED.has(file) && !isTest(file))
      .filter((file) => COLOR_FN.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("scans the TypeScript tree and skips only tokens.ts and the tests", () => {
    const ts = sources().filter((file) => /\.tsx?$/.test(file));
    expect(ts).toContain("src/model/competitions.ts");
    expect(ts).toContain("src/model/clubs.ts");
    expect(isTest("src/design/no-hex.test.ts")).toBe(true);
    expect(isTest("src/components/x/Y.test.tsx")).toBe(true);
    expect(isTest("src/model/competitions.ts")).toBe(false);
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

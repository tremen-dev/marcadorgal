import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COLORS, FAMILIES } from "./tokens";

const rootOf = (css: string): Map<string, string> => {
  const block = css.match(/:root\s*\{([^}]*)\}/)?.[1] ?? "";
  const vars = new Map<string, string>();
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    vars.set(m[1], m[2].trim());
  }
  return vars;
};

const normalize = (value: string): string =>
  value.replace(/["']/g, "").replace(/\s+/g, "").toLowerCase();

const system = rootOf(readFileSync("docs/diseno/_tokens.css", "utf8"));
const generated = rootOf(readFileSync("src/design/tokens.css", "utf8"));

const tokensByCssVar = new Map<string, string>([
  ...Object.values(COLORS).map((c) => [c.css, c.value] as [string, string]),
  ...Object.entries(FAMILIES).map(
    ([name, stack]) => [`--${name}`, stack] as [string, string],
  ),
]);

describe("CA-6 parity with docs/diseno/_tokens.css", () => {
  it("parses the system's :root", () => {
    expect(system.size).toBeGreaterThanOrEqual(17);
    expect(system.get("--fg-prov")).toBe("#8E8C88");
  });

  const inherited = [...system].filter(([name]) => name !== "--fg-prov");

  it.each(inherited)(
    "%s is in tokens.ts with the same value",
    (name, value) => {
      expect(tokensByCssVar.has(name), `${name} missing in tokens.ts`).toBe(
        true,
      );
      expect(normalize(tokensByCssVar.get(name) ?? "")).toBe(normalize(value));
    },
  );

  it.each(inherited)(
    "%s is in tokens.css with the same value",
    (name, value) => {
      expect(generated.has(name), `${name} missing in tokens.css`).toBe(true);
      expect(normalize(generated.get(name) ?? "")).toBe(normalize(value));
    },
  );

  it("--fg-prov is neither in tokens.ts nor in tokens.css", () => {
    expect(tokensByCssVar.has("--fg-prov")).toBe(false);
    expect(generated.has("--fg-prov")).toBe(false);
  });
});

import { globSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import { describe, expect, it } from "vitest";
import { COLORS } from "./tokens";

// SPEC-081 (ADR-035): the motto by the wordmark, --fg at 72 % on --bg.
const css = readFileSync("src/components/xornada/Xornada.module.css", "utf8");

const channels = (hex: string): number[] =>
  [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));

const luminance = (rgb: number[]): number => {
  const [r, g, b] = rgb
    .map((c) => c / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: number[], b: number[]): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const lemaRule = css.match(/\n\.lema\s*\{([^}]*)\}/)?.[1] ?? "";

describe("SPEC-081 CA-6 the motto's contrast", () => {
  it("the .lema rule is --fg with opacity 0.72 and --hand 400", () => {
    expect(lemaRule).toMatch(/color: var\(--fg\);/);
    expect(lemaRule).toMatch(/opacity: 0\.72;/);
    expect(lemaRule).toMatch(/font-family: var\(--hand\);/);
    expect(lemaRule).toMatch(/font-weight: 400;/);
  });

  it("--fg at 0.72 over --bg is at least 4.5:1 (≈ 8.9:1)", () => {
    const opacity = Number(lemaRule.match(/opacity:\s*([\d.]+);/)?.[1]);
    expect(opacity).toBe(0.72);
    const fg = channels(COLORS.fg.value);
    const bg = channels(COLORS.bg.value);
    const blended = fg.map((c, i) => c * opacity + bg[i] * (1 - opacity));
    const ratio = contrast(blended, bg);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBeCloseTo(8.9, 0);
  });
});

describe("SPEC-081 ADR-035 §2 one use only", () => {
  it("var(--hand) appears once under src/, in the motto's rule", () => {
    const uses = globSync("src/**/*.{css,ts,tsx}")
      .map((f) => relative(process.cwd(), f).replaceAll("\\", "/"))
      .filter((file) => !file.endsWith(".test.ts"))
      .flatMap((file) =>
        readFileSync(file, "utf8")
          .split("\n")
          .flatMap((line, i) =>
            line.includes("var(--hand)") ? [`${file}:${i + 1}`] : [],
          ),
      );
    expect(uses).toHaveLength(1);
    expect(uses[0]).toMatch(/^src\/components\/xornada\/Xornada\.module\.css:/);
  });
});

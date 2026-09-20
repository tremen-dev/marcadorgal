import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderTokensCss } from "./css";
import { COLORS } from "./tokens";

const css = renderTokensCss();

describe("CA-5 generated CSS", () => {
  it("is identical to the committed src/design/tokens.css", () => {
    expect(css).toBe(readFileSync("src/design/tokens.css", "utf8"));
  });

  it("starts with the generated header and has a single :root block", () => {
    expect(
      css.startsWith(
        "/* GENERATED from tokens.ts by tools/tokens-css.mjs — do not edit */\n",
      ),
    ).toBe(true);
    expect(css.match(/:root\s*\{/g)).toHaveLength(1);
    expect(css.match(/\{/g)).toHaveLength(1);
  });

  it("declares the variables the spec names", () => {
    const lines = css.split("\n").map((l) => l.trim());
    for (const expected of [
      `--bg: ${COLORS.bg.value};`,
      `--marca: ${COLORS.brand.value};`,
      `--directo: ${COLORS.ember.value};`,
      `--alerta: ${COLORS.red.value};`,
      `--bg-subtle: ${COLORS.bgSubtle.value};`,
      `--bg-live: ${COLORS.bgLive.value};`,
      `--line-row: ${COLORS.lineRow.value};`,
      "--sans: 'Geist',ui-sans-serif,system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif;",
      "--mono: 'Geist Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace;",
      "--font-display: 800 44px/1 var(--sans);",
      "--tracking-display: -0.045em;",
      "--font-score: 600 20px/1 var(--mono);",
      "--font-team: 500 15px/1.2 var(--sans);",
      "--tracking-team: -0.01em;",
      "--font-status: 600 13px/1 var(--mono);",
      "--font-eyebrow: 600 11px/1 var(--mono);",
      "--tracking-eyebrow: 0.15em;",
      "--space-4: 4px;",
      "--space-48: 48px;",
      "--radius-sm: 8px;",
      "--radius-pill: 999px;",
      "--bar-desktop-top: 56px;",
      "--bar-mobile-bottom: 60px;",
      "--row-wide: 52px;",
      "--row-compact: 30px;",
      "--sidebar: 236px;",
      "--panel: 372px;",
      "--grid-row-wide: 56px minmax(0, 1fr) 52px 32px;",
      "--grid-row-compact: 32px minmax(0, 1fr) 46px minmax(0, 1fr) 14px;",
      "--live-dot-size: 6px;",
      "--live-dot-glow: 0 0 8px;",
      "--live-edge: inset 2px 0 0;",
      "--touch-target: 44px;",
      "--focus-ring: 2px;",
      "--input-font: 16px;",
      "--hairline: 1px;",
    ]) {
      expect(lines, expected).toContain(expected);
    }
    expect(css).not.toContain("--fg-prov");
    expect(css).not.toContain("--tracking-score");
    expect(css).not.toContain("--tracking-status");
  });
});

describe("CA-5 globals.css", () => {
  const globals = readFileSync("src/app/globals.css", "utf8");

  it("starts by importing the generated tokens", () => {
    expect(globals.startsWith('@import "../design/tokens.css";\n')).toBe(true);
  });

  it("keeps no hand-written :root block and keeps color-scheme dark", () => {
    expect(globals).not.toMatch(/:root\s*\{/);
    expect(globals).toMatch(/color-scheme:\s*dark/);
  });
});

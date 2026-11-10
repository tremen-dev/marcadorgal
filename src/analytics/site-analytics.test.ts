import { describe, expect, it } from "vitest";
import { MeasuredAnalytics } from "./MeasuredAnalytics";
import { SiteAnalytics, shouldMeasure } from "./SiteAnalytics";

// SPEC-077 CA-1: Web Analytics only in Production (ADR-033 §4).
describe("SiteAnalytics (SPEC-077 CA-1)", () => {
  it.each([
    ["production", true],
    ["preview", false],
    ["development", false],
    ["", false],
    [undefined, false],
  ] as const)("VERCEL_ENV=%s renders it: %s", (vercelEnv, renders) => {
    expect(shouldMeasure(vercelEnv)).toBe(renders);
    const element = SiteAnalytics({ vercelEnv });
    if (renders) expect(element?.type).toBe(MeasuredAnalytics);
    else expect(element).toBeNull();
  });

  it("reads VERCEL_ENV from the environment by default", () => {
    const previous = process.env.VERCEL_ENV;
    try {
      process.env.VERCEL_ENV = "production";
      expect(SiteAnalytics({})?.type).toBe(MeasuredAnalytics);
      delete process.env.VERCEL_ENV;
      expect(SiteAnalytics({})).toBeNull();
    } finally {
      if (previous === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = previous;
    }
  });
});

describe("one mount point (SPEC-077 CA-1)", () => {
  it("both layouts mount SiteAnalytics and only src/analytics imports the package", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const path = await import("node:path");
    const root = path.resolve(import.meta.dirname, "..");
    for (const layout of ["app/(gl)/layout.tsx", "app/(es)/es/layout.tsx"]) {
      const source = readFileSync(path.join(root, layout), "utf8");
      expect(source, layout).toContain("<SiteAnalytics />");
    }
    const importers = (readdirSync(root, { recursive: true }) as string[])
      .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
      .filter((file) =>
        readFileSync(path.join(root, file), "utf8").includes(
          "@vercel/analytics",
        ),
      )
      .map((file) => file.replaceAll("\\", "/"));
    expect(importers).toEqual(["analytics/MeasuredAnalytics.tsx"]);
  });
});

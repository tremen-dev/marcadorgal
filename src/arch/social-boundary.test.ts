import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkSocialImports } from "./social-boundary";

// SPEC-066 CA-12 (ADR-030 §5): src/social/** never imports src/decide,
// src/sources or src/ingest, and none of them imports src/social. They only
// meet in the table and in the route of the tick (src/app), which wires.

describe("SPEC-066 CA-12 checkSocialImports", () => {
  it("lets src/social import the model, i18n, postgres, zod, node and itself", () => {
    const src = `
import type { Sql } from "postgres";
import { z } from "zod";
import { readFileSync } from "node:fs";
import type { Instant } from "../model/index.ts";
import { GOAL_TEMPLATES } from "../i18n/social.gl.ts";
import { GALICIAN_SEASONS } from "../calendar/galicians.ts";
import galegos from "../../data/galegos/2026-27.json";
import { pickTemplate } from "./pick.ts";
import { socialConfig } from "@/social/config";
`;
    expect(checkSocialImports("src/social/dispatch.ts", src)).toEqual([]);
  });

  it.each([
    `import { decide } from "../decide/index.ts";`,
    `import type { DecisionDraft } from "@/decide";`,
    `import { SOURCES } from "../sources/registry.ts";`,
    `import { runTick } from "@/ingest/tick";`,
    `import type { IngestDb } from "../ingest/db.ts";`,
    `const m = await import("../ingest/engine.ts");`,
  ])("flags %s inside src/social", (src) => {
    const violations = checkSocialImports("src/social/dispatch.ts", src);
    expect(violations).toHaveLength(1);
    expect(violations[0].file).toBe("src/social/dispatch.ts");
  });

  it.each([
    [
      "src/ingest/tick.ts",
      `import { dispatchSocial } from "../social/dispatch.ts";`,
    ],
    ["src/ingest/engine.ts", `import type { SocialDb } from "@/social/port";`],
    [
      "src/decide/engine.ts",
      `import { GOAL_TEMPLATES } from "../social/text.ts";`,
    ],
    ["src/sources/rfef/explorer.ts", `import { x } from "../../social/db.ts";`],
  ])("flags %s importing src/social", (file, src) => {
    expect(checkSocialImports(file, src)).toHaveLength(1);
  });

  it("lets src/ingest declare the shape of the counters without importing", () => {
    expect(
      checkSocialImports(
        "src/ingest/tick.ts",
        `import type { EngineCounts } from "./engine.ts";\nexport type SocialCounts = { sent: number };`,
      ),
    ).toEqual([]);
  });

  it("says nothing about files elsewhere, such as the route", () => {
    expect(
      checkSocialImports(
        "src/app/api/ingest/tick/route.ts",
        `import { runTick } from "@/ingest/tick";\nimport { createSocialDb } from "@/social/db";`,
      ),
    ).toEqual([]);
  });
});

const root = path.resolve(__dirname, "../..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("SPEC-066 CA-12 the tree", () => {
  it("src/social, src/decide, src/sources and src/ingest keep the frontier", () => {
    const files = ["social", "decide", "sources", "ingest"].flatMap((dir) =>
      walk(path.join(root, "src", dir)),
    );
    expect(files.length).toBeGreaterThan(20);
    const violations = files.flatMap((abs) =>
      checkSocialImports(path.relative(root, abs), readFileSync(abs, "utf8")),
    );
    expect(violations).toEqual([]);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config.ts";

// SPEC-030 CA-1 and CA-2 (H-1 a): / and /es are rendered per request and
// cached by the CDN with the directives of ADR-014 §6, never ISR, never
// prerendered at build. The headers and the build output are checked over
// next start in e2e/home.spec.ts; the curl -I is in the ledger.

const HOMES = ["src/app/(gl)/page.tsx", "src/app/(es)/es/page.tsx"];

describe("SPEC-030 CA-1 / and /es are dynamic", () => {
  it.each(HOMES)("%s: force-dynamic, no revalidate", (page) => {
    const source = readFileSync(page, "utf8");
    expect(source).toMatch(/export const dynamic = "force-dynamic";/);
    expect(source).not.toMatch(/export const revalidate/);
  });

  it("CA-5: expireTime is unchanged (the week pages are still ISR)", () => {
    expect(nextConfig.expireTime).toBe(40);
  });
});

import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config.ts";
import { BOARD_CACHE_CONTROL } from "../board/http.ts";

// SPEC-027 CA-4 (ADR-014 §6): each week page is ISR of 10 s, rendered on
// demand (nothing at build) and served with the directives of / and
// /api/board. The curl -I over next start is in the ledger.

const PAGES = [
  "src/app/(gl)/xornada/[fecha]/page.tsx",
  "src/app/(es)/es/xornada/[fecha]/page.tsx",
];

describe("SPEC-027 CA-4 cache of /xornada/[fecha]", () => {
  it("serves / , /es and both week routes with the /api/board directives", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const cache = (source: string) =>
      rules
        .find((r) => r.source === source)
        ?.headers.find((h) => h.key === "Cache-Control")?.value;
    for (const source of ["/", "/es", "/xornada/:fecha", "/es/xornada/:fecha"])
      expect(cache(source)).toBe(BOARD_CACHE_CONTROL);
    expect(BOARD_CACHE_CONTROL).toBe(
      "public, s-maxage=10, stale-while-revalidate=30",
    );
  });

  it.each(PAGES)("%s: revalidate 10 and no params at build", (page) => {
    expect(existsSync(page)).toBe(true);
    const source = readFileSync(page, "utf8");
    expect(source).toMatch(/export const revalidate = 10;/);
    expect(source).toMatch(/generateStaticParams\(\)[^\n]*\{\s*return \[\];/);
    expect(source).not.toMatch(/dynamicParams\s*=\s*false/);
  });
});

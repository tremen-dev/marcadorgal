import { afterEach, describe, expect, it, vi } from "vitest";

// H-2: Vercel Cron invokes by GET, so the route exports the very same handler
// for both methods — same guard, same maxDuration and, above all, the same
// path, because outputFileTracingIncludes is indexed by route and a second
// one would deploy without the alias (ADR-008 §8).
const MODULE = "./route.ts";

const env = { ...process.env };
// Not one variable: next-env.d.ts declares NODE_ENV as required, so the empty
// object needs the cast to say exactly that.
const noEnv = () => {
  process.env = {} as NodeJS.ProcessEnv;
};
afterEach(() => {
  process.env = { ...env };
  vi.resetModules();
});

describe("SPEC-008 CA-2 GET and POST on /api/ingest/tick", () => {
  it("imports with no environment variable at all (counterproof of CA-1)", async () => {
    vi.resetModules();
    noEnv();
    const mod = await import(MODULE);
    expect(typeof mod.POST).toBe("function");
  });

  it("exports GET and POST as the same function", async () => {
    vi.resetModules();
    noEnv();
    const { GET, POST } = await import(MODULE);
    expect(typeof GET).toBe("function");
    expect(GET).toBe(POST);
  });

  it("keeps runtime, dynamic and maxDuration", async () => {
    vi.resetModules();
    noEnv();
    const mod = await import(MODULE);
    expect(mod.runtime).toBe("nodejs");
    expect(mod.dynamic).toBe("force-dynamic");
    expect(mod.maxDuration).toBe(60);
  });
});

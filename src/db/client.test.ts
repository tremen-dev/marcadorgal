import { afterEach, describe, expect, it, vi } from "vitest";

// F-SPEC-006-4: the module used to evaluate createSql(process.env) at import
// time, so next build without DATABASE_URL failed collecting the route. The
// pool is memoized behind getSql(), so importing costs nothing.
const MODULE = "./client.ts";
const URL_ = "postgres://user:pass@localhost:5432/marcadorgal";

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
  vi.resetModules();
});

describe("SPEC-008 CA-1 src/db/client.ts is lazy", () => {
  it("imports without DATABASE_URL and does not throw", async () => {
    vi.resetModules();
    process.env = { ...env, DATABASE_URL: undefined };
    delete process.env.DATABASE_URL;
    const mod = await import(MODULE);
    expect(typeof mod.getSql).toBe("function");
  });

  it("throws DATABASE_URL is not set only when getSql() is called", async () => {
    vi.resetModules();
    process.env = { ...env };
    delete process.env.DATABASE_URL;
    const { getSql } = await import(MODULE);
    expect(() => getSql()).toThrow("DATABASE_URL is not set");
  });

  it("memoizes the pool: two calls give the same instance", async () => {
    vi.resetModules();
    process.env = { ...env, DATABASE_URL: URL_ };
    const { getSql } = await import(MODULE);
    const first = getSql();
    expect(getSql()).toBe(first);
    await first.end();
  });
});

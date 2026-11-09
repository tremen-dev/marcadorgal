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

// SPEC-020 CA-9 (ADR-015 §2): the route hands its own now to authorizeTick,
// so the signature of pg_cron passes the guard only around the present.
describe("SPEC-020 CA-9 the route checks the signed bearer against now", () => {
  const TOKEN = "route-test-token-0123456789abcdef0123";
  const bearer = async (epoch: number) => {
    const { createHmac } = await import("node:crypto");
    const sig = createHmac("sha256", TOKEN).update(`t1.${epoch}`).digest("hex");
    return `Bearer t1.${epoch}.${sig}`;
  };
  const call = async (authorization: string) => {
    vi.resetModules();
    process.env = { INGEST_TICK_TOKEN: TOKEN } as unknown as NodeJS.ProcessEnv;
    const { POST } = await import(MODULE);
    return POST(
      new Request("http://localhost/api/ingest/tick", {
        method: "POST",
        headers: { authorization },
      }),
    ) as Promise<Response>;
  };

  it("lets a signature of now through the guard", async () => {
    // Past the guard the tick needs a database it does not have here: 500,
    // never 401.
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call(await bearer(Math.floor(Date.now() / 1000)));
    expect(res.status).toBe(500);
    error.mockRestore();
  });

  it("refuses a signature two minutes old", async () => {
    const res = await call(await bearer(Math.floor(Date.now() / 1000) - 120));
    expect(res.status).toBe(401);
  });
});

// SPEC-066 CA-11 (ADR-030 §3): the route wires the social dispatch as the
// third hook of runTick, so it runs in every tick, window or not.
describe("SPEC-066 CA-11 the route wires the social dispatch", () => {
  it("hands runTick a social hook next to afterInsert and sweep", async () => {
    vi.resetModules();
    const TOKEN = "route-test-token-0123456789abcdef0123";
    process.env = {
      INGEST_TICK_TOKEN: TOKEN,
      DATABASE_URL: "postgresql://x:y@127.0.0.1:1/z",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:1",
      SUPABASE_SERVICE_ROLE_KEY: "test",
    } as unknown as NodeJS.ProcessEnv;
    const inputs: unknown[] = [];
    vi.doMock("@/ingest/tick", () => ({
      runTick: async (input: unknown) => {
        inputs.push(input);
        return { now: "x", inWindow: 0, purge: "skipped", attempts: [] };
      },
    }));
    try {
      const { POST } = await import(MODULE);
      const { createHmac } = await import("node:crypto");
      const epoch = Math.floor(Date.now() / 1000);
      const sig = createHmac("sha256", TOKEN)
        .update(`t1.${epoch}`)
        .digest("hex");
      const res = await POST(
        new Request("http://localhost/api/ingest/tick", {
          method: "POST",
          headers: { authorization: `Bearer t1.${epoch}.${sig}` },
        }),
      );
      expect(res.status).toBe(200);
      expect(inputs).toHaveLength(1);
      const input = inputs[0] as Record<string, unknown>;
      expect(typeof input.afterInsert).toBe("function");
      expect(typeof input.sweep).toBe("function");
      expect(typeof input.social).toBe("function");
    } finally {
      vi.doUnmock("@/ingest/tick");
    }
  });
});

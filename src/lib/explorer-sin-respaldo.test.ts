import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rfefCalendar } from "../sources/rfef/calendar.ts";
import { fetchExplorer, getDayMatchesRaw } from "./explorer-client.ts";

// SPEC-093 CA-5: no silent fallback. Without RFEF_EXPLORER_URL or without
// RFEF_EXPLORER_TOKEN every way to explorer outside the tick fails out loud,
// naming the variable, before any request leaves. The tick already did
// (src/ingest/adapters.ts).

const URL_VAR = "RFEF_EXPLORER_URL";
const TOKEN_VAR = "RFEF_EXPLORER_TOKEN";

const spy = () => {
  const calls: string[] = [];
  const fetch = (async (url: string | URL | Request) => {
    calls.push(String(url));
    return new Response("{}", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof globalThis.fetch;
  return { calls, fetch };
};

const calendarCtx = (fetch: typeof globalThis.fetch) => ({
  apiKey: "",
  fetch,
  userAgent: "marcador.gal (test)",
});

describe("SPEC-093 CA-5 no silent fallback to explorer", () => {
  beforeEach(() => {
    vi.stubEnv(URL_VAR, "https://explorer.test");
    vi.stubEnv(TOKEN_VAR, "tok");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const ways: [string, (fetch: typeof globalThis.fetch) => Promise<unknown>][] =
    [
      ["fetchExplorer", (f) => fetchExplorer("/api/export/standings", {}, f)],
      ["getDayMatchesRaw", (f) => getDayMatchesRaw("2026-11-01", f)],
      [
        "the rfef calendar (segunda-division)",
        (f) =>
          rfefCalendar.fetch("segunda-division", "2026-27", calendarCtx(f)),
      ],
    ];

  for (const [name, call] of ways) {
    for (const missing of [URL_VAR, TOKEN_VAR]) {
      it(`${name} without ${missing} throws naming it and never fetches`, async () => {
        vi.stubEnv(missing, "");
        const { calls, fetch } = spy();
        await expect(call(fetch)).rejects.toThrow(missing);
        expect(calls).toEqual([]);
      });
    }

    it(`${name} with both variables asks the configured origin with the token`, async () => {
      const seen: { url: string; auth: string | null }[] = [];
      const fetch = (async (
        url: string | URL | Request,
        init?: RequestInit,
      ) => {
        seen.push({
          url: String(url),
          auth: new Headers(init?.headers).get("authorization"),
        });
        return new Response("{}", { status: 200 });
      }) as typeof globalThis.fetch;
      await call(fetch).catch(() => {});
      expect(seen).toHaveLength(1);
      expect(seen[0].url.startsWith("https://explorer.test/")).toBe(true);
      expect(seen[0].auth).toBe("Bearer tok");
    });
  }

  it("Tercera goes by file and needs neither variable nor network (SPEC-090 CA-1)", async () => {
    vi.stubEnv(URL_VAR, "");
    vi.stubEnv(TOKEN_VAR, "");
    const { calls, fetch } = spy();
    const raw = await rfefCalendar.fetch(
      "tercera-rfef-g1",
      "2026-27",
      calendarCtx(fetch),
    );
    expect(raw).toMatchObject({ declared: "tercera-rfef-g1" });
    expect(calls).toEqual([]);
  });
});

// The code of src/ and tools/ (tests and the README of the fixtures aside,
// which documents where the captures came from) names explorer only by its
// two canonical variables.
describe("SPEC-093 CA-5 no alias and no fixed url in the code", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const CODE = /\.(ts|tsx|mjs)$/;
  const TEST = /\.test\.(ts|tsx|mjs)$/;

  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      if (name === "node_modules") return [];
      if (statSync(full).isDirectory()) return walk(full);
      return CODE.test(name) && !TEST.test(name) ? [full] : [];
    });
  }

  const FORBIDDEN: [string, RegExp][] = [
    ["marcadorgal-explorer.vercel.app", /marcadorgal-explorer\.vercel\.app/],
    ["EXPLORER_BASE_URL", /EXPLORER_BASE_URL/],
    ["EXPLORER_API_KEY", /EXPLORER_API_KEY/],
    ["EXPLORER_TOKEN", /(?<!RFEF_)EXPLORER_TOKEN/],
  ];

  it("walks real code of both folders", () => {
    const files = [
      ...walk(path.join(root, "src")),
      ...walk(path.join(root, "tools")),
    ];
    expect(files.length).toBeGreaterThan(100);
    expect(files.some((f) => f.endsWith("explorer-client.ts"))).toBe(true);
    expect(files.some((f) => f.endsWith("calendario-sync.mjs"))).toBe(true);
  });

  it("no file names the fixed url or an alias of the two variables", () => {
    const hits: string[] = [];
    for (const file of [
      ...walk(path.join(root, "src")),
      ...walk(path.join(root, "tools")),
    ]) {
      const text = readFileSync(file, "utf8");
      for (const [name, pattern] of FORBIDDEN)
        if (pattern.test(text))
          hits.push(`${path.relative(root, file)}: ${name}`);
    }
    expect(hits).toEqual([]);
  });

  it("the pattern of EXPLORER_TOKEN spares RFEF_EXPLORER_TOKEN", () => {
    const pattern = /(?<!RFEF_)EXPLORER_TOKEN/;
    expect(pattern.test("process.env.RFEF_EXPLORER_TOKEN")).toBe(false);
    expect(pattern.test("process.env.EXPLORER_TOKEN")).toBe(true);
  });
});

import { describe, expect, it, vi } from "vitest";
import { guardFetch } from "./fetch-guard.ts";

// SPEC-022 CA-5: inside test:db, fetch only reaches loopback. No network here:
// the underlying fetch is a double.
describe("SPEC-022 CA-5 fetch guard", () => {
  it.each([
    [
      "https://v3.football.api-sports.io/fixtures?live=all",
      "v3.football.api-sports.io",
    ],
    ["https://x.supabase.co/storage/v1/object/raw/a.json.gz", "x.supabase.co"],
  ])("rejects %s without calling the real fetch", async (url, host) => {
    const real = vi.fn(async () => new Response("no"));
    const guarded = guardFetch(real);
    await expect(guarded(url)).rejects.toThrow(host);
    await expect(guarded(new URL(url))).rejects.toThrow(host);
    await expect(guarded(new Request(url))).rejects.toThrow(host);
    expect(real).not.toHaveBeenCalled();
  });

  it("rejects what does not parse as an absolute URL", async () => {
    const real = vi.fn(async () => new Response("no"));
    await expect(guardFetch(real)("/relative")).rejects.toThrow();
    expect(real).not.toHaveBeenCalled();
  });

  it.each([
    "http://127.0.0.1:54321/storage/v1/object/raw/a.json.gz",
    "http://localhost:54321/rest/v1/",
    "http://[::1]:54321/",
  ])("delegates %s to the real fetch", async (url) => {
    const res = new Response("ok");
    const real = vi.fn(async () => res);
    const init = { method: "PUT" };
    expect(await guardFetch(real)(url, init)).toBe(res);
    expect(real).toHaveBeenCalledWith(url, init);
  });
});

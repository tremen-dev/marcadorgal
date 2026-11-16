import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DayMatchesResponse } from "@/lib/explorer-client";
import { DirectosScreen } from "./directos-screen.tsx";

// SPEC-087 CA-2 over the screen both pages render: next/navigation's
// redirect throws in a Server Component; here it is a spy that throws too.
const redirect = vi.hoisted(() =>
  vi.fn((location: string): never => {
    throw new Error(`NEXT_REDIRECT ${location}`);
  }),
);
vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  redirect,
}));

const NOW = "2026-11-16T10:00:00Z";
const EMPTY: DayMatchesResponse = {
  date: "2026-11-16",
  exportedAt: NOW,
  matches: [],
};

beforeEach(() => {
  redirect.mockClear();
});

describe("SPEC-087 CA-2 the page redirects an invalid date", () => {
  it.each([
    ["gl", "/directos"],
    ["es", "/es/directos"],
  ] as const)(
    "%s: temporary redirect to %s, explorer untouched",
    async (locale, location) => {
      const getDayMatches = vi.fn(async () => EMPTY);
      await expect(
        DirectosScreen({
          locale,
          searchParams: Promise.resolve({ date: "2026-02-30" }),
          deps: { now: NOW, getDayMatches },
        }),
      ).rejects.toThrow(`NEXT_REDIRECT ${location}`);
      expect(redirect).toHaveBeenCalledWith(location);
      expect(getDayMatches).not.toHaveBeenCalled();
    },
  );

  it("a valid date renders the page without redirecting", async () => {
    const getDayMatches = vi.fn(async () => EMPTY);
    const html = renderToStaticMarkup(
      await DirectosScreen({
        locale: "gl",
        searchParams: Promise.resolve({ date: "2026-11-15" }),
        deps: { now: NOW, getDayMatches },
      }),
    );
    expect(redirect).not.toHaveBeenCalled();
    expect(html).toContain('data-testid="directos-page"');
    expect(html).toContain("2026-11-15");
  });

  it("a failing explorer renders the unavailable state", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const getDayMatches = vi.fn(async (): Promise<DayMatchesResponse> => {
        throw new Error("[explorer] Error 502 en /api/export/matches");
      });
      const html = renderToStaticMarkup(
        await DirectosScreen({
          locale: "es",
          searchParams: Promise.resolve({}),
          deps: { now: NOW, getDayMatches },
        }),
      );
      expect(html).toContain('data-testid="directos-unavailable"');
      expect(error).toHaveBeenCalledTimes(1);
    } finally {
      error.mockRestore();
    }
  });
});

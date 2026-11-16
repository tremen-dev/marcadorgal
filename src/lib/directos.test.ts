import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";
import { type DirectosDeps, directosDate, readDirectos } from "./directos.ts";
import type { DayMatchesResponse } from "./explorer-client.ts";
import { EXPLORER_ENRICHMENT_TIMEOUT_MS } from "./explorer-enrichment.ts";

// SPEC-087: /directos and /es/directos. Every test runs without network and
// with a fixed clock: now is a parameter, never read inside the logic.

const NOW = "2026-11-16T10:00:00Z";

describe("SPEC-087 CA-1 directosDate", () => {
  it("without date: today in Europe/Madrid", () => {
    expect(directosDate(undefined, NOW)).toBe("2026-11-16");
  });

  it("edge: at 23:30Z of the 15th it is already the 16th in Madrid", () => {
    expect(directosDate(undefined, "2026-11-15T23:30:00Z")).toBe("2026-11-16");
    expect(directosDate("2026-11-23", "2026-11-15T23:30:00Z")).toBe(
      "2026-11-23",
    );
    expect(directosDate("2026-11-24", "2026-11-15T23:30:00Z")).toBeNull();
  });

  it.each([
    "2026-11-16",
    "2026-11-09",
    "2026-11-23",
    "2026-11-12",
  ])("a real date within ±7 days: %s", (raw) => {
    expect(directosDate(raw, NOW)).toBe(raw);
  });

  it.each([
    ["2026-02-30", "not a calendar date"],
    ["2026-1-5", "no padding"],
    ["20261116", "no dashes"],
    ["2026-11-16T00:00", "an instant, not a date"],
    ["2026-11-24", "8 days ahead"],
    ["2026-11-08", "8 days behind"],
    ["2027-11-16", "a year ahead"],
    ["", "empty"],
  ])("null for %s (%s)", (raw) => {
    expect(directosDate(raw, NOW)).toBeNull();
  });

  it("null for a repeated value (string[])", () => {
    expect(directosDate(["2026-11-16", "2026-11-15"], NOW)).toBeNull();
    expect(directosDate(["2026-11-16"], NOW)).toBeNull();
  });
});

const DAY: DayMatchesResponse = {
  date: "2026-11-16",
  exportedAt: "2026-11-16T09:59:00Z",
  matches: [
    {
      matchKey: "k1",
      canonicalCompetitionId: "liga-f",
      homeTeam: "Deportivo ABANCA",
      awayTeam: "FC Barcelona Femení",
      homeScore: 1,
      awayScore: 0,
      estado: "LIVE_PROVISIONAL",
      minute: 30,
    },
  ],
};

type GetDay = NonNullable<DirectosDeps["getDayMatches"]>;
const answering = (body: DayMatchesResponse) =>
  vi.fn<GetDay>(async () => body);

describe("SPEC-087 CA-2 an invalid date redirects without asking explorer", () => {
  it.each([
    ["gl", "/directos"],
    ["es", "/es/directos"],
  ] as const)("%s: redirect to %s", async (locale, location) => {
    const getDayMatches = answering(DAY);
    for (const raw of ["2026-02-30", "2026-11-30", ["a", "b"]]) {
      const read = await readDirectos(raw, NOW, locale, { getDayMatches });
      expect(read).toEqual({ kind: "redirect", location });
    }
    expect(getDayMatches).not.toHaveBeenCalled();
  });
});

describe("SPEC-087 CA-3 the day read has a deadline", () => {
  it("passes { timeoutMs: EXPLORER_ENRICHMENT_TIMEOUT_MS } to getDayMatches", async () => {
    const getDayMatches = answering(DAY);
    await readDirectos("2026-11-15", NOW, "gl", { getDayMatches });
    expect(getDayMatches).toHaveBeenCalledTimes(1);
    expect(getDayMatches).toHaveBeenCalledWith("2026-11-15", undefined, {
      timeoutMs: EXPLORER_ENRICHMENT_TIMEOUT_MS,
    });
  });

  it("an explorer that never answers ends as unavailable when the deadline passes", async () => {
    vi.useFakeTimers();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const getDayMatches = vi.fn<GetDay>(() => new Promise<never>(() => {}));
      let settled = false;
      const pending = readDirectos(undefined, NOW, "gl", {
        getDayMatches,
      }).then((r) => {
        settled = true;
        return r;
      });
      await vi.advanceTimersByTimeAsync(EXPLORER_ENRICHMENT_TIMEOUT_MS - 1);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(await pending).toEqual({
        kind: "unavailable",
        date: "2026-11-16",
      });
    } finally {
      error.mockRestore();
      vi.useRealTimers();
    }
  });
});

describe("SPEC-087 CA-4 a failing explorer is logged and unavailable", () => {
  let error: MockInstance<typeof console.error>;
  beforeEach(() => {
    error = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => error.mockRestore());

  it.each([
    ["deadline", new Error("[explorer] timeout 2000 ms")],
    ["HTTP 5xx", new Error("[explorer] Error 503 en /api/export/matches")],
    ["invalid JSON", new SyntaxError("Unexpected token < in JSON")],
  ])("%s: console.error with date and message", async (_case, cause) => {
    const getDayMatches = vi.fn<GetDay>(async () => {
      throw cause;
    });
    const read = await readDirectos("2026-11-14", NOW, "es", {
      getDayMatches,
    });
    expect(read).toEqual({ kind: "unavailable", date: "2026-11-14" });
    expect(error).toHaveBeenCalledTimes(1);
    const line = String(error.mock.calls[0]?.[0]);
    expect(line).toContain("2026-11-14");
    expect(line).toContain(cause.message);
  });

  it("a 200 whose body is not the export (no matches array) is unavailable too", async () => {
    const getDayMatches = vi.fn<GetDay>(
      async () => ({ error: "x" }) as unknown as DayMatchesResponse,
    );
    const read = await readDirectos(undefined, NOW, "gl", { getDayMatches });
    expect(read.kind).toBe("unavailable");
    expect(error).toHaveBeenCalledTimes(1);
  });
});

describe("SPEC-087 CA-5 an empty day is a page, not a failure", () => {
  it("200 with matches: [] gives a page with no competitions and no console.error", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const getDayMatches = answering({ ...DAY, matches: [] });
      const read = await readDirectos(undefined, NOW, "gl", {
        getDayMatches,
      });
      expect(read).toEqual({ kind: "page", date: "2026-11-16", grouped: [] });
      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });

  it("a day with matches gives them grouped", async () => {
    const read = await readDirectos(undefined, NOW, "gl", {
      getDayMatches: answering(DAY),
    });
    expect(read.kind).toBe("page");
    if (read.kind === "page")
      expect(read.grouped.map((g) => g.competitionId)).toEqual(["liga-f"]);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicMatch } from "@/model";
import { initialBoard } from "@/xornada/live";
import { xornadaDays } from "@/xornada/view";
import {
  type ChannelHandlers,
  type LiveSnapshot,
  POLL_MS,
  RECONCILE_MS,
  RETRY_MAX_MS,
  RETRY_MIN_MS,
  SUBSCRIBE_TIMEOUT_MS,
  startLiveXornada,
} from "./transport";

// SPEC-024 CA-6 and CA-7 with doubles: the channel, fetch, the clock (fake
// timers) and the switch (openChannel null = off).

const T0 = Date.parse("2026-10-10T17:00:00.000Z");
const SEASON = "2026-27";
const ETAG = '"served"';

function match(id: string, version: number, extra = {}): PublicMatch {
  return {
    matchId: id,
    competitionId: "primera-division",
    competitionName: "Primeira División",
    tier: 1,
    round: 9,
    kickoff: "2026-10-10T16:00:00.000Z",
    home: { name: "Home", shortName: null },
    away: { name: "Away", shortName: null },
    status: "live",
    score: { home: version, away: 0 },
    minute: 50,
    addedMinute: null,
    halfTime: false,
    qualifier: "confirmado",
    version,
    observedAt: "2026-10-10T16:55:00.000Z",
    decidedAt: "2026-10-10T16:55:05.000Z",
    ...extra,
  } as PublicMatch;
}

// The same match as the trigger sends it (a row of web.xornada).
function payload(id: string, version: number, extra = {}) {
  return {
    match_id: id,
    competition_id: "primera-division",
    season: SEASON,
    competition_name: "Primeira División",
    tier: 1,
    round: 9,
    kickoff: "2026-10-10T16:00:00+00:00",
    home_name: "Home",
    home_short_name: null,
    away_name: "Away",
    away_short_name: null,
    status: "live",
    home_score: version,
    away_score: 0,
    minute: 50,
    added_minute: null,
    qualifier: "confirmado",
    version,
    observed_at: "2026-10-10T16:55:00+00:00",
    decided_at: "2026-10-10T16:55:05+00:00",
    half_time: false,
    id: "message-id",
    ...extra,
  };
}

type Reply =
  | { status: number; etag?: string; matches?: PublicMatch[] }
  | "network";

function fakeFetch(replies: Reply[] | (() => Reply)) {
  const calls: { url: string; init: RequestInit }[] = [];
  const next = (): Reply =>
    typeof replies === "function"
      ? replies()
      : (replies.shift() ?? { status: 304 });
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const reply = next();
    if (reply === "network") throw new TypeError("Failed to fetch");
    const headers = new Headers(reply.etag ? { ETag: reply.etag } : {});
    return new Response(
      reply.status === 200
        ? JSON.stringify({ matches: reply.matches ?? [] })
        : reply.status === 304
          ? null
          : JSON.stringify({ error: "unavailable" }),
      { status: reply.status, headers },
    );
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

function fakeChannel() {
  const opened: {
    season: string;
    handlers: ChannelHandlers;
    closed: boolean;
  }[] = [];
  const open = vi.fn(async (season: string, handlers: ChannelHandlers) => {
    const entry = { season, handlers, closed: false };
    opened.push(entry);
    return {
      close: () => {
        entry.closed = true;
      },
    };
  });
  return { open, opened, last: () => opened[opened.length - 1] };
}

function fakeVisibility() {
  let hidden = false;
  const listeners = new Set<() => void>();
  return {
    hidden: () => hidden,
    subscribe: (cb: () => void) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    set(value: boolean) {
      hidden = value;
      for (const cb of listeners) cb();
    },
  };
}

const START = [match("a", 2), match("b", 1)];

function start(options: {
  fetch: typeof fetch;
  open?: ReturnType<typeof fakeChannel>["open"] | null;
  random?: () => number;
  visibility?: ReturnType<typeof fakeVisibility>;
}) {
  const snapshots: LiveSnapshot[] = [];
  const live = startLiveXornada({
    board: initialBoard(START, xornadaDays(START, new Date(T0).toISOString())),
    season: SEASON,
    etag: ETAG,
    fetch: options.fetch,
    openChannel: options.open ?? null,
    random: options.random ?? (() => 0.5),
    visibility: options.visibility ?? fakeVisibility(),
    onChange: (s) => snapshots.push(s),
  });
  const last = () => snapshots[snapshots.length - 1] ?? live.snapshot();
  return { live, snapshots, last };
}

const ids = (s: LiveSnapshot) => [...s.board.matches.keys()];
const painted = (s: LiveSnapshot) =>
  [...s.board.matches.values()].map((m) => ({
    id: m.matchId,
    status: m.status,
    qualifier: m.qualifier,
    score: m.score,
  }));

beforeEach(() => {
  vi.useFakeTimers({ now: T0 });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("SPEC-024 CA-7 polling (switch off: the normal mode)", () => {
  it("never opens a channel; asks /api/board every 30 s with the served ETag and no-store", async () => {
    const f = fakeFetch([]);
    const { live, last } = start({ fetch: f.fn });
    expect(last().mode).toBe("polling");
    await vi.advanceTimersByTimeAsync(POLL_MS - 1);
    expect(f.calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].url).toBe("/api/board");
    expect(f.calls[0].init.cache).toBe("no-store");
    expect(new Headers(f.calls[0].init.headers).get("If-None-Match")).toBe(
      ETAG,
    );
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(f.calls).toHaveLength(2);
    expect(POLL_MS).toBe(30_000);
    live.stop();
  });

  it.each([
    [0, 24_000],
    [0.999999, 36_000],
  ])("jitter ±20 %%: random %f → first request at ~%i ms", async (r, at) => {
    const f = fakeFetch([]);
    const { live } = start({ fetch: f.fn, random: () => r });
    await vi.advanceTimersByTimeAsync(at - 1);
    expect(f.calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(2);
    expect(f.calls).toHaveLength(1);
    live.stop();
  });

  it("304 only moves the browser clock", async () => {
    const f = fakeFetch([{ status: 304 }]);
    const { live, last } = start({ fetch: f.fn });
    const before = last().board;
    expect(last().lastSeen).toBeNull();
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(last().lastSeen).toBe(T0 + POLL_MS);
    expect(last().board).toBe(before);
    expect(last().offline).toBe(false);
    live.stop();
  });

  it("200 applies the list and its ETag is sent next time", async () => {
    const f = fakeFetch([
      { status: 200, etag: '"two"', matches: [match("a", 3), match("c", 1)] },
      { status: 304 },
    ]);
    const { live, last } = start({ fetch: f.fn });
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(ids(last())).toEqual(["a", "c"]);
    expect(last().board.matches.get("a" as never)?.version).toBe(3);
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(new Headers(f.calls[1].init.headers).get("If-None-Match")).toBe(
      '"two"',
    );
    live.stop();
  });

  it("an invalid row of a 200 is left out, never painted", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const bad = {
      ...match("x", 1),
      status: "halftime",
    } as unknown as PublicMatch;
    const f = fakeFetch([
      { status: 200, etag: '"x"', matches: [match("a", 2), bad] },
    ]);
    const { live, last } = start({ fetch: f.fn });
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(ids(last())).toEqual(["a"]);
    live.stop();
  });

  it("pauses with the tab hidden and asks when it comes back", async () => {
    const f = fakeFetch([]);
    const visibility = fakeVisibility();
    const { live } = start({ fetch: f.fn, visibility });
    visibility.set(true);
    await vi.advanceTimersByTimeAsync(5 * POLL_MS);
    expect(f.calls).toHaveLength(0);
    visibility.set(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(f.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(f.calls).toHaveLength(2);
    live.stop();
  });

  it.each([
    ["a network failure", "network" as const],
    ["a 503", { status: 503 }],
  ])(
    "%s → «sen conexión»; 20 min of failures leave the matches identical (D-9)",
    async (_n, reply) => {
      const f = fakeFetch(() => reply);
      const { live, last } = start({ fetch: f.fn });
      const before = painted(last());
      await vi.advanceTimersByTimeAsync(20 * 60_000);
      expect(f.calls.length).toBeGreaterThanOrEqual(39);
      expect(last().offline).toBe(true);
      expect(painted(last())).toEqual(before);
      expect(last().lastSeen).toBeNull();
      live.stop();
    },
  );

  it("a later 304 leaves «sen conexión»", async () => {
    const f = fakeFetch(["network", { status: 304 }]);
    const { live, last } = start({ fetch: f.fn });
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(last().offline).toBe(true);
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(last().offline).toBe(false);
    live.stop();
  });
});

describe("SPEC-024 CA-6 Realtime (switch on)", () => {
  it("opens board:<season> and waits for SUBSCRIBED (connecting)", async () => {
    const ch = fakeChannel();
    const f = fakeFetch([]);
    const { live, last } = start({ fetch: f.fn, open: ch.open });
    await vi.advanceTimersByTimeAsync(0);
    expect(ch.open).toHaveBeenCalledTimes(1);
    expect(ch.last().season).toBe(SEASON);
    expect(last().mode).toBe("connecting");
    live.stop();
    expect(ch.last().closed).toBe(true);
  });

  it("SUBSCRIBED: polling stops, one catch-up request, reconciliation every 5 min", async () => {
    const ch = fakeChannel();
    const f = fakeFetch([]);
    const { live, last } = start({ fetch: f.fn, open: ch.open });
    await vi.advanceTimersByTimeAsync(0);
    ch.last().handlers.status("SUBSCRIBED");
    await vi.advanceTimersByTimeAsync(0);
    expect(last().mode).toBe("realtime");
    expect(f.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(RECONCILE_MS - 1);
    expect(f.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(RECONCILE_MS);
    expect(f.calls).toHaveLength(3);
    expect(RECONCILE_MS).toBe(5 * 60_000);
    live.stop();
  });

  it("a heartbeat ok in SUBSCRIBED moves the browser clock", async () => {
    const ch = fakeChannel();
    const { live, last } = start({ fetch: fakeFetch([]).fn, open: ch.open });
    await vi.advanceTimersByTimeAsync(0);
    ch.last().handlers.status("SUBSCRIBED");
    await vi.advanceTimersByTimeAsync(25_000);
    ch.last().handlers.heartbeat();
    expect(last().lastSeen).toBe(T0 + 25_000);
    live.stop();
  });

  it("a delta with a higher version is painted; equal or lower, not; invalid, dropped", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const ch = fakeChannel();
    const { live, last } = start({ fetch: fakeFetch([]).fn, open: ch.open });
    await vi.advanceTimersByTimeAsync(0);
    const h = ch.last().handlers;
    h.status("SUBSCRIBED");
    await vi.advanceTimersByTimeAsync(1_000);
    h.delta(payload("a", 3, { home_score: 4 }));
    expect(last().board.matches.get("a" as never)?.score).toEqual({
      home: 4,
      away: 0,
    });
    expect(last().lastSeen).toBe(T0 + 1_000);
    const board = last().board;
    h.delta(payload("a", 3, { home_score: 9 }));
    h.delta(payload("a", 1));
    expect(last().board).toBe(board);
    h.delta(payload("a", 4, { status: "halftime" }));
    expect(last().board).toBe(board);
    expect(error).toHaveBeenCalledTimes(1);
    live.stop();
  });

  it("an unknown matchId asks /api/board (at most once every 30 s)", async () => {
    const ch = fakeChannel();
    const f = fakeFetch([]);
    const { live } = start({ fetch: f.fn, open: ch.open });
    await vi.advanceTimersByTimeAsync(0);
    const h = ch.last().handlers;
    h.status("SUBSCRIBED");
    await vi.advanceTimersByTimeAsync(0);
    expect(f.calls).toHaveLength(1);
    h.delta(payload("z", 1));
    h.delta(payload("y", 1));
    await vi.advanceTimersByTimeAsync(0);
    expect(f.calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(30_000);
    h.delta(payload("y", 1));
    await vi.advanceTimersByTimeAsync(0);
    expect(f.calls).toHaveLength(3);
    live.stop();
  });

  it.each(["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"])(
    "%s: closes the socket, polls, retries at 60 s doubling up to 5 min",
    async (status) => {
      const ch = fakeChannel();
      const f = fakeFetch([]);
      const { live, last } = start({ fetch: f.fn, open: ch.open });
      await vi.advanceTimersByTimeAsync(0);
      ch.last().handlers.status(status);
      await vi.advanceTimersByTimeAsync(0);
      expect(ch.opened[0].closed).toBe(true);
      expect(last().mode).toBe("polling");
      // A request right away, then every 30 s.
      expect(f.calls).toHaveLength(1);
      expect(new Headers(f.calls[0].init.headers).get("If-None-Match")).toBe(
        ETAG,
      );
      const retries: number[] = [];
      let at = 0;
      for (let i = 0; i < 5; i++) {
        const opened = ch.opened.length;
        while (ch.opened.length === opened) {
          await vi.advanceTimersByTimeAsync(1_000);
          at += 1_000;
        }
        retries.push(at);
        at = 0;
        ch.last().handlers.status(status);
        await vi.advanceTimersByTimeAsync(0);
      }
      expect(retries).toEqual([60_000, 120_000, 240_000, 300_000, 300_000]);
      expect(RETRY_MIN_MS).toBe(60_000);
      expect(RETRY_MAX_MS).toBe(300_000);
      live.stop();
    },
  );

  it("no SUBSCRIBED in 10 s is a failure", async () => {
    const ch = fakeChannel();
    const f = fakeFetch([]);
    const { live, last } = start({ fetch: f.fn, open: ch.open });
    await vi.advanceTimersByTimeAsync(SUBSCRIBE_TIMEOUT_MS - 1);
    expect(last().mode).toBe("connecting");
    await vi.advanceTimersByTimeAsync(1);
    expect(last().mode).toBe("polling");
    expect(ch.opened[0].closed).toBe(true);
    expect(SUBSCRIBE_TIMEOUT_MS).toBe(10_000);
    // A late SUBSCRIBED of the closed channel changes nothing.
    ch.opened[0].handlers.status("SUBSCRIBED");
    ch.opened[0].handlers.delta(payload("a", 9));
    expect(last().mode).toBe("polling");
    expect(last().board.matches.get("a" as never)?.version).toBe(2);
    live.stop();
  });

  it("the retry delay has ±20 % jitter", async () => {
    const ch = fakeChannel();
    const { live } = start({
      fetch: fakeFetch([]).fn,
      open: ch.open,
      random: () => 0,
    });
    await vi.advanceTimersByTimeAsync(0);
    ch.last().handlers.status("CHANNEL_ERROR");
    await vi.advanceTimersByTimeAsync(48_000 - 1);
    expect(ch.opened).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(ch.opened).toHaveLength(2);
    live.stop();
  });

  it("a failing open falls back to polling", async () => {
    const open = vi.fn(async () => {
      throw new Error("no socket");
    });
    const f = fakeFetch([]);
    const { live, last } = start({ fetch: f.fn, open });
    await vi.advanceTimersByTimeAsync(0);
    expect(last().mode).toBe("polling");
    live.stop();
  });

  it("SUBSCRIBED again resets the retry delay to 60 s", async () => {
    const ch = fakeChannel();
    const { live } = start({ fetch: fakeFetch([]).fn, open: ch.open });
    await vi.advanceTimersByTimeAsync(0);
    ch.last().handlers.status("CHANNEL_ERROR");
    await vi.advanceTimersByTimeAsync(60_000);
    ch.last().handlers.status("SUBSCRIBED");
    await vi.advanceTimersByTimeAsync(0);
    ch.last().handlers.status("CLOSED");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(ch.opened).toHaveLength(3);
    live.stop();
  });
});

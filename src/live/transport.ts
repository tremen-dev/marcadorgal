import { toPublicMatch } from "@/board/row";
import { PublicMatch } from "@/model";
import type { TransportMode } from "@/xornada/freshness";
import { applyBoard, applyDelta, type LiveBoard } from "@/xornada/live";

// SPEC-024 CA-6 and CA-7 (H-2, H-3, ADR-002 §7, ADR-014 §5-§7): how the
// screen keeps itself up to date. Polling of /api/board is the normal mode
// with the switch off and the fallback with it on; Realtime (a channel opened
// by openChannel) only with the switch on. A transport failure never touches
// the matches (D-9): it only says «sen conexión».
//
// The browser clock (Date.now, setTimeout) is the one of the screen line; the
// tests replace it with fake timers.

export const POLL_MS = 30_000;
export const JITTER = 0.2;
export const SUBSCRIBE_TIMEOUT_MS = 10_000;
export const RECONCILE_MS = 5 * 60_000;
export const RETRY_MIN_MS = 60_000;
export const RETRY_MAX_MS = 5 * 60_000;
export const BOARD_URL = "/api/board";

export type ChannelHandlers = {
  // SUBSCRIBED, CHANNEL_ERROR, TIMED_OUT or CLOSED (supabase-js).
  status(status: string): void;
  // The payload of a broadcast «decision»: a row of web.xornada.
  delta(payload: unknown): void;
  // A heartbeat answered by the server.
  heartbeat(): void;
};

export type OpenChannel = (
  season: string,
  handlers: ChannelHandlers,
) => Promise<{ close(): void }>;

export type Visibility = {
  hidden(): boolean;
  subscribe(onChange: () => void): () => void;
};

export type LiveSnapshot = {
  board: LiveBoard;
  mode: TransportMode;
  // The last /api/board request failed (network or not 200/304).
  offline: boolean;
  // Browser clock of the last delta, 200/304 or heartbeat ok; null before.
  lastSeen: number | null;
};

export type LiveDeps = {
  board: LiveBoard;
  season: string;
  // The ETag of the served xornada, so the first request can be a 304.
  etag: string | null;
  fetch: typeof fetch;
  // null: the switch is off (or misconfigured), polling only.
  openChannel: OpenChannel | null;
  random(): number;
  visibility: Visibility;
  onChange(snapshot: LiveSnapshot): void;
};

const FAILED = new Set(["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"]);

const jitter = (ms: number, random: () => number): number =>
  Math.round(ms * (1 - JITTER + 2 * JITTER * random()));

function parseList(body: unknown): PublicMatch[] | null {
  const list = (body as { matches?: unknown } | null)?.matches;
  if (!Array.isArray(list)) return null;
  const out: PublicMatch[] = [];
  for (const item of list) {
    const parsed = PublicMatch.safeParse(item);
    if (parsed.success) out.push(parsed.data);
    else
      console.error(
        `/api/board: ${String((item as { matchId?: unknown })?.matchId)} is not a PublicMatch, left out`,
      );
  }
  return out;
}

export function startLiveXornada(deps: LiveDeps): {
  snapshot(): LiveSnapshot;
  stop(): void;
} {
  let state: LiveSnapshot = {
    board: deps.board,
    mode: deps.openChannel === null ? "polling" : "connecting",
    offline: false,
    lastSeen: null,
  };
  let etag = deps.etag;
  let stopped = false;
  let inFlight = false;
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  let reconcileTimer: ReturnType<typeof setTimeout> | undefined;
  let subscribeTimer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let retryDelay = RETRY_MIN_MS;
  let generation = 0;
  let channel: { close(): void } | null = null;

  const set = (patch: Partial<LiveSnapshot>) => {
    state = { ...state, ...patch };
    if (!stopped) deps.onChange(state);
  };
  const seen = () => set({ lastSeen: Date.now(), offline: false });

  async function request(): Promise<void> {
    if (inFlight || stopped) return;
    inFlight = true;
    try {
      const response = await deps.fetch(BOARD_URL, {
        cache: "no-store",
        headers: etag === null ? {} : { "If-None-Match": etag },
      });
      if (stopped) return;
      if (response.status === 304) {
        seen();
        return;
      }
      const list = response.ok ? parseList(await response.json()) : null;
      if (stopped) return;
      if (list === null) {
        set({ offline: true });
        return;
      }
      etag = response.headers.get("ETag") ?? etag;
      set({
        board: applyBoard(state.board, list, new Date().toISOString()),
        lastSeen: Date.now(),
        offline: false,
      });
    } catch {
      if (!stopped) set({ offline: true });
    } finally {
      inFlight = false;
    }
  }

  function schedulePoll(): void {
    clearTimeout(pollTimer);
    pollTimer = undefined;
    if (stopped || state.mode === "realtime" || deps.visibility.hidden())
      return;
    pollTimer = setTimeout(
      async () => {
        await request();
        schedulePoll();
      },
      jitter(POLL_MS, deps.random),
    );
  }

  function scheduleReconcile(): void {
    clearTimeout(reconcileTimer);
    reconcileTimer = setTimeout(async () => {
      await request();
      if (state.mode === "realtime") scheduleReconcile();
    }, RECONCILE_MS);
  }

  function closeChannel(): void {
    generation++;
    clearTimeout(subscribeTimer);
    clearTimeout(reconcileTimer);
    channel?.close();
    channel = null;
  }

  function fail(): void {
    if (stopped) return;
    closeChannel();
    set({ mode: "polling" });
    void request();
    schedulePoll();
    clearTimeout(retryTimer);
    retryTimer = setTimeout(connect, jitter(retryDelay, deps.random));
    retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
  }

  function subscribed(): void {
    clearTimeout(subscribeTimer);
    retryDelay = RETRY_MIN_MS;
    set({ mode: "realtime" });
    clearTimeout(pollTimer);
    pollTimer = undefined;
    void request();
    scheduleReconcile();
  }

  function delta(payload: unknown): void {
    const match = toPublicMatch(payload);
    if (match === null) return;
    const out = applyDelta(state.board, match, Date.now());
    set({ board: out.board, lastSeen: Date.now(), offline: false });
    if (out.request) void request();
  }

  function connect(): void {
    const open = deps.openChannel;
    if (stopped || open === null) return;
    const mine = ++generation;
    const current = () => mine === generation && !stopped;
    // Only the first attempt is `connecting`. A retry keeps `polling`: it is
    // still the effective source until SUBSCRIBED, so the notice stays (V-1).
    if (state.mode !== "polling") set({ mode: "connecting" });
    subscribeTimer = setTimeout(() => {
      if (current()) fail();
    }, SUBSCRIBE_TIMEOUT_MS);
    open(deps.season, {
      status(status) {
        if (!current()) return;
        if (status === "SUBSCRIBED") subscribed();
        else if (FAILED.has(status)) fail();
      },
      delta(payload) {
        if (current()) delta(payload);
      },
      heartbeat() {
        if (current() && state.mode === "realtime") seen();
      },
    }).then(
      (opened) => {
        if (current()) channel = opened;
        else opened.close();
      },
      () => {
        if (current()) fail();
      },
    );
  }

  const unsubscribe = deps.visibility.subscribe(() => {
    if (deps.visibility.hidden()) {
      clearTimeout(pollTimer);
      pollTimer = undefined;
    } else if (state.mode !== "realtime") {
      void request();
      schedulePoll();
    }
  });

  schedulePoll();
  connect();

  return {
    snapshot: () => state,
    stop() {
      closeChannel();
      stopped = true;
      clearTimeout(pollTimer);
      clearTimeout(retryTimer);
      unsubscribe();
    },
  };
}

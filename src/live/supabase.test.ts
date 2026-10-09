// biome-ignore-all lint/suspicious/noExplicitAny: a loose double of supabase-js.
import { describe, expect, it, vi } from "vitest";
import { supabaseOpener } from "./supabase";

// SPEC-024 CA-6 (ADR-014 §5, §7, N-3): the supabase-js client of the screen,
// with a double of createClient. No session, no storage, a private channel.

function fakeSupabase() {
  const calls: { url: string; key: string; options: Record<string, any> }[] =
    [];
  const channels: {
    name: string;
    opts: any;
    bindings: { type: string; filter: any; cb: (msg: any) => void }[];
    subscribe?: (status: string) => void;
  }[] = [];
  const removed: string[] = [];
  const disconnect = vi.fn(async () => "ok");
  const create = vi.fn((url: string, key: string, options: any) => {
    calls.push({ url, key, options });
    return {
      channel(name: string, opts: any) {
        const entry = {
          name,
          opts,
          bindings: [] as any[],
          subscribe: undefined as any,
        };
        channels.push(entry);
        const ch = {
          on(type: string, filter: any, cb: (msg: any) => void) {
            entry.bindings.push({ type, filter, cb });
            return ch;
          },
          subscribe(cb: (status: string) => void) {
            entry.subscribe = cb;
            return ch;
          },
        };
        return ch;
      },
      removeChannel: vi.fn(async () => {
        removed.push(channels[channels.length - 1]?.name ?? "");
        return "ok";
      }),
      realtime: { disconnect },
    };
  });
  return { create, calls, channels, removed, disconnect };
}

const handlers = () => ({
  status: vi.fn(),
  delta: vi.fn(),
  heartbeat: vi.fn(),
});

describe("SPEC-024 CA-6 supabaseOpener", () => {
  it("creates the client with the URL and key, no session, no storage", async () => {
    const s = fakeSupabase();
    const open = supabaseOpener(
      { url: "http://127.0.0.1:54321", key: "k" },
      s.create as any,
    );
    await open("2026-27", handlers());
    expect(s.calls).toHaveLength(1);
    const [{ url, key, options }] = s.calls;
    expect([url, key]).toEqual(["http://127.0.0.1:54321", "k"]);
    expect(options.auth).toMatchObject({
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    });
    // Longpoll fallback history in memory, never sessionStorage.
    const store = options.realtime.sessionStorage as Storage;
    store.setItem("a", "1");
    expect(store.getItem("a")).toBe("1");
    expect(store).not.toBe(globalThis.sessionStorage);
  });

  it("subscribes to the private channel board:<season> and forwards decision broadcasts", async () => {
    const s = fakeSupabase();
    const h = handlers();
    await supabaseOpener({ url: "u", key: "k" }, s.create as any)("2026-27", h);
    expect(s.channels).toHaveLength(1);
    const [ch] = s.channels;
    expect(ch.name).toBe("board:2026-27");
    expect(ch.opts).toMatchObject({ config: { private: true } });
    expect(ch.bindings).toHaveLength(1);
    expect(ch.bindings[0].type).toBe("broadcast");
    expect(ch.bindings[0].filter).toEqual({ event: "decision" });
    ch.bindings[0].cb({
      type: "broadcast",
      event: "decision",
      payload: { match_id: "a" },
    });
    expect(h.delta).toHaveBeenCalledWith({ match_id: "a" });
    ch.subscribe?.("SUBSCRIBED");
    expect(h.status).toHaveBeenCalledWith("SUBSCRIBED");
  });

  it("N-3: heartbeatCallback «ok» is the heartbeat; the rest are not", async () => {
    const s = fakeSupabase();
    const h = handlers();
    await supabaseOpener({ url: "u", key: "k" }, s.create as any)("2026-27", h);
    const cb = s.calls[0].options.realtime.heartbeatCallback as (
      st: string,
    ) => void;
    for (const status of ["sent", "error", "timeout", "disconnected"])
      cb(status);
    expect(h.heartbeat).not.toHaveBeenCalled();
    cb("ok");
    expect(h.heartbeat).toHaveBeenCalledTimes(1);
  });

  it("close removes the channel and disconnects the socket; a reopen reuses the client", async () => {
    const s = fakeSupabase();
    const open = supabaseOpener({ url: "u", key: "k" }, s.create as any);
    const first = await open("2026-27", handlers());
    first.close();
    await Promise.resolve();
    expect(s.removed).toEqual(["board:2026-27"]);
    expect(s.disconnect).toHaveBeenCalled();
    const h2 = handlers();
    await open("2026-27", h2);
    expect(s.create).toHaveBeenCalledTimes(1);
    // The heartbeat goes to the handlers of the channel open now.
    (s.calls[0].options.realtime.heartbeatCallback as (st: string) => void)(
      "ok",
    );
    expect(h2.heartbeat).toHaveBeenCalledTimes(1);
  });
});

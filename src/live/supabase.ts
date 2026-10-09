import { createClient } from "@supabase/supabase-js";
import type { RealtimeConfig } from "./config";
import type { ChannelHandlers, OpenChannel } from "./transport";

// SPEC-024 CA-6 (ADR-014 §5, §7): the only module that imports supabase-js.
// It is loaded with a dynamic import and only with NEXT_PUBLIC_REALTIME=on,
// so it never reaches the initial JS. No session, no Auth, no storage: no
// cookies and nothing in localStorage or sessionStorage of whoever watches.

type Create = typeof createClient;

// The longpoll fallback of the socket keeps a history; here, in memory.
function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => {
      items.delete(key);
    },
    setItem: (key, value) => {
      items.set(key, String(value));
    },
  };
}

// One client per page; each open is a new channel on it (a retry after a
// close). N-3: the heartbeat is realtime's heartbeatCallback with «ok».
export function supabaseOpener(
  config: RealtimeConfig,
  create: Create = createClient,
): OpenChannel {
  let current: ChannelHandlers | null = null;
  let client: ReturnType<Create> | null = null;
  const clientOf = () =>
    (client ??= create(config.url, config.key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      realtime: {
        heartbeatCallback: (status) => {
          if (status === "ok") current?.heartbeat();
        },
        sessionStorage: memoryStorage(),
      },
    }));

  return async (season, handlers) => {
    const supabase = clientOf();
    current = handlers;
    const channel = supabase
      .channel(`board:${season}`, { config: { private: true } })
      .on("broadcast", { event: "decision" }, (message) =>
        handlers.delta(message.payload),
      )
      .subscribe((status) => handlers.status(status));
    return {
      close() {
        if (current === handlers) current = null;
        void supabase
          .removeChannel(channel)
          .finally(() => supabase.realtime.disconnect());
      },
    };
  };
}

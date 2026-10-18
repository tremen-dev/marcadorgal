// Test support (SPEC-032 CA-10, ADR-020): a strict double of
// marcadores.rfef.es with the headers of
// docs/epicas/EPIC-004-fuente-rfef/_qa/calibracion/2026-10-12-handshake.md.
// A session only opens as the server opens it: the portada without cookie
// gives the cookie and sends to NLogin; NLogin with that cookie activates it;
// the panel answers only to an active cookie, and otherwise sends to NLogin.
// The urls are written here, not imported from adapter.ts, so that the double
// does not agree with the adapter by construction. Only tests import it.

const ORIGIN = "https://marcadores.rfef.es";
export const DOUBLE_PORTADA = `${ORIGIN}/pnfg/`;
export const DOUBLE_NLOGIN = `${ORIGIN}/pnfg/NLogin?NSess=1`;
export const DOUBLE_PANEL = `${ORIGIN}/pnfg/NPcd/NFG_CMP_Paneles`;

export type ServerCall = {
  n: number;
  url: string;
  method: string;
  cookie: string | null;
  userAgent: string | null;
  contentType: string | null;
  redirect: RequestRedirect | undefined;
  body: string | null;
};

export type RfefServerOptions = {
  // The JSESSIONID values the portada hands out, in order.
  cookies?: readonly string[];
  // The answer of the panel to an active session.
  panel: (call: ServerCall) => Response;
};

const sessionOf = (cookie: string | null): string | null =>
  cookie?.match(/(?:^|;\s*)JSESSIONID=([^;\s]+)/)?.[1] ?? null;

export function rfefServer({ cookies = [], panel }: RfefServerOptions) {
  const issued = new Set<string>();
  const active = new Set<string>();
  const calls: ServerCall[] = [];
  let next = 0;

  const unexpected = (call: ServerCall) =>
    new Error(`double: unexpected ${call.method} ${call.url}`);

  function handle(input: string | URL | Request, init?: RequestInit) {
    const headers = new Headers(init?.headers);
    const call: ServerCall = {
      n: calls.length + 1,
      url: String(input),
      method: init?.method ?? "GET",
      cookie: headers.get("cookie"),
      userAgent: headers.get("user-agent"),
      contentType: headers.get("content-type"),
      redirect: init?.redirect,
      body: typeof init?.body === "string" ? init.body : null,
    };
    calls.push(call);
    // fetch would follow the 302 and drop the cookie (ADR-020, alternatives).
    if (call.redirect !== "manual")
      throw new Error("double: redirect is not manual");
    const session = sessionOf(call.cookie);

    if (call.method === "GET" && call.url === DOUBLE_PORTADA) {
      if (call.cookie !== null) throw unexpected(call);
      next += 1;
      const value =
        cookies[next - 1] ?? `DOBLE${String(next).padStart(4, "0")}`;
      issued.add(value);
      return new Response(null, {
        status: 302,
        headers: {
          "set-cookie": `JSESSIONID=${value}; Path=/pnfg; Secure; HttpOnly`,
          location: "/pnfg/NLogin?NSess=1",
        },
      });
    }
    if (call.method === "GET" && call.url === DOUBLE_NLOGIN) {
      if (session === null || !issued.has(session)) throw unexpected(call);
      active.add(session);
      return new Response(null, {
        status: 302,
        headers: { location: `${ORIGIN}/pnfg/` },
      });
    }
    if (call.method === "POST" && call.url === DOUBLE_PANEL) {
      if (session !== null && active.has(session)) return panel(call);
      return new Response(null, {
        status: 302,
        headers: { location: "/pnfg/NLogin" },
      });
    }
    throw unexpected(call);
  }

  return {
    calls,
    fetch: (async (input: string | URL | Request, init?: RequestInit) =>
      handle(input, init)) as typeof globalThis.fetch,
    // The server forgets every session: the next POST is sent to NLogin.
    expire: () => active.clear(),
  };
}

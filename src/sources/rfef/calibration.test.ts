import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { AliasFile } from "../../model/index.ts";
import {
  nloginInit,
  PANEL_ENJUEGO_QUERY,
  PANEL_QUERY,
  PANEL_URL,
  PORTADA_URL,
  panelInit,
  portadaInit,
  USER_AGENT,
} from "./adapter.ts";
import {
  analyze,
  buildPlan,
  buildReport,
  type CalendarMatch,
  type CalibrateDeps,
  type CalibrationLine,
  calibrate,
  exitCode,
  formatPlan,
  inWindow,
  planRounds,
  preconditions,
} from "./calibration.ts";
import { EMPTY_BODY_FILE, fixtureBytes } from "./fixture-files.ts";
import { DOUBLE_NLOGIN, rfefServer } from "./server-double.ts";

// SPEC-032: the calibration of the RFEF cadence. Every test runs against a
// fetch double: no request ever leaves for marcadores.rfef.es.

const noFetch = () =>
  vi.fn(async (): Promise<Response> => {
    throw new Error("no request may leave in this test");
  });

describe("CA-1 dry-run plan", () => {
  it("has the six steps, max(30 min, 10 requests) each, ~175 rounds, ~177 requests and ~3 h", () => {
    const plan = buildPlan();
    expect(plan.steps.map((s) => s.intervalSeconds)).toEqual([
      180, 120, 90, 60, 45, 30,
    ]);
    expect(plan.steps.map((s) => s.rounds)).toEqual([10, 15, 20, 30, 40, 60]);
    expect(plan.steps.map((s) => s.seconds)).toEqual(Array(6).fill(1800));
    expect(plan.rounds).toBe(175);
    // Portada and NLogin open the session (ADR-020 §1), then one POST per round.
    expect(plan.maxRequests).toBe(177);
    expect(plan.seconds).toBe(3 * 3600);
  });

  it("the rounds: todos first and last, Sch_en_juego=1 in between", () => {
    const rounds = planRounds(buildPlan());
    expect(rounds).toHaveLength(175);
    expect(rounds[0]).toMatchObject({
      index: 1,
      intervalSeconds: 180,
      nInStep: 1,
      variant: "todos",
    });
    expect(rounds[174]).toMatchObject({
      index: 175,
      intervalSeconds: 30,
      nInStep: 60,
      variant: "todos",
    });
    expect(rounds.slice(1, -1).every((r) => r.variant === "enjuego")).toBe(
      true,
    );
    expect(rounds[10]).toMatchObject({ intervalSeconds: 120, nInStep: 1 });
  });

  it("--dry-run prints the plan and makes 0 calls", async () => {
    const fetch = noFetch();
    const log: string[] = [];
    const result = await calibrate(
      { dryRun: true, lastRequest: null, lastLogged: null },
      {
        fetch,
        now: () => Date.parse("2026-10-17T15:00:00Z"),
        sleep: async () => {},
        record: async () => {},
        log: (m) => log.push(m),
        calendar: [],
        aliases: AliasFile.parse({
          source: "rfef",
          season: "2026-27",
          teams: [],
        }),
      },
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(result.kind).toBe("dry-run");
    const text = log.join("\n");
    expect(text).toBe(formatPlan(buildPlan()).join("\n"));
    for (const s of ["180 s", "120 s", "90 s", "60 s", "45 s", "30 s"])
      expect(text).toContain(s);
    expect(text).toMatch(/Peticiones máximas: 177/);
    expect(text).toMatch(/NLogin/);
    expect(text).toMatch(/nunca más de 4 por vuelta/);
    expect(text).toMatch(/3 h/);
  });
});

// ---- Harness: a fetch double and a fake clock -------------------------------

// Bytes on their own ArrayBuffer, as a Response body wants them.
const copy = (b: Uint8Array) => Uint8Array.from(b);
const T0 = Date.parse("2026-10-17T15:00:00Z");
const ALIASES = AliasFile.parse(
  JSON.parse(
    readFileSync(new URL("fixtures/alias-test.json", import.meta.url), "utf8"),
  ),
);
// A Tercera match at 15:05Z: in window at T0 (ADR-002 §2).
const CALENDAR = [
  {
    id: "tercera-rfef-g1-2026-27-j6-alondras-arenteiro",
    competitionId: "tercera-rfef-g1",
    round: 6,
    homeTeamId: "alondras",
    awayTeamId: "arenteiro",
    kickoff: "2026-10-17T15:05:00Z",
  },
] as unknown as CalendarMatch[];
const COOKIE = "SECRETO0123456789ABCDEF";
const TODOS = copy(
  fixtureBytes("campo-post-2026-10-11T15-00-15Z-todos.raw.gz"),
);
const ENJUEGO = copy(
  fixtureBytes("paneles-fed3-enjuego-2026-10-10T21-33-30Z.raw"),
);
const LOGIN = readFileSync(
  new URL("fixtures/sin-cookie-aceptada.html", import.meta.url),
);
const EMPTY = copy(fixtureBytes(EMPTY_BODY_FILE));
const CT = "text/html;charset=ISO-8859-15";

type Call = { url: string; init: RequestInit; at: number; n: number };
type Reply = Response | "network" | { response: Response; takesMs: number };
const panelReply = (bytes: Uint8Array<ArrayBuffer>, salt = "") =>
  new Response(
    salt === "" ? bytes : copy(Buffer.concat([bytes, Buffer.from(salt)])),
    {
      status: 200,
      headers: {
        "content-type": CT,
        date: "Sat, 17 Oct 2026 15:00:00 GMT",
      },
    },
  );

// By default the strict double of CA-10 answers (ADR-020): the session only
// opens with portada and NLogin, and the panel gives real fixtures with a
// salt, so no two bodies repeat. A script can answer a call instead, or call
// `serve` to let the double answer it.
type Serve = (call: Call) => Promise<Response>;

function harness(
  script: (call: Call, serve: Serve) => Reply | undefined = () => undefined,
) {
  let t = T0;
  const calls: Call[] = [];
  const server = rfefServer({
    cookies: [COOKIE, "RENOVADA42", "TERCERA77"],
    panel: (c) =>
      panelReply(
        String(c.body).endsWith("Sch_en_juego=1") ? ENJUEGO : TODOS,
        `<!-- ${calls.length} -->`,
      ),
  });
  const serve: Serve = (call) => server.fetch(call.url, call.init);
  const lines: CalibrationLine[] = [];
  const bodies: Uint8Array[] = [];
  const logs: string[] = [];
  const fetch = vi.fn(
    async (url: string | URL | Request, init?: RequestInit) => {
      const call = {
        url: String(url),
        init: init ?? {},
        at: t,
        n: calls.length + 1,
      };
      calls.push(call);
      const reply = script(call, serve) ?? (await serve(call));
      if (reply === "network") throw new TypeError("fetch failed");
      if (reply instanceof Response) return reply;
      t += reply.takesMs;
      return reply.response;
    },
  );
  const deps: CalibrateDeps = {
    fetch: fetch as unknown as typeof globalThis.fetch,
    now: () => t,
    sleep: async (ms) => {
      t += ms;
    },
    record: (line, body) => {
      lines.push(line);
      bodies.push(body);
    },
    log: (m) => logs.push(m),
    calendar: CALENDAR,
    aliases: ALIASES,
  };
  const ok = {
    dryRun: false,
    lastRequest: "2026-10-16T14:00:00Z",
    lastLogged: null,
  };
  return {
    calls,
    lines,
    bodies,
    logs,
    fetch,
    deps,
    ok,
    server,
    now: () => t,
  };
}

const posts = (calls: Call[]) => calls.filter((c) => c.init.method === "POST");
const cookieOf = (c: Call) => (c.init.headers as Record<string, string>).Cookie;
const roundStarts = (lines: CalibrationLine[]) => {
  const out = new Map<number, number>();
  for (const l of lines)
    if (!out.has(l.vuelta)) out.set(l.vuelta, Date.parse(l.inicio));
  return [...out.values()];
};
const roundOf = (n: number) => planRounds(buildPlan())[n - 1];
// Round n of a run with no renewal is call n + 2 (portada and NLogin first).
const callOfRound = (n: number) => n + 2;
const perRound = (lines: CalibrationLine[]) => {
  const out = new Map<number, string[]>();
  for (const l of lines)
    out.set(l.vuelta, [
      ...(out.get(l.vuelta) ?? []),
      `${l.metodo} ${l.variante} ${l.resultado}`,
    ]);
  return out;
};

describe("CA-2 the production pattern (ADR-019 §1-§2, ADR-020)", () => {
  it("round 1: portada, NLogin and POST todos; then one POST Sch_en_juego=1 with the same cookie; last: POST todos", async () => {
    const h = harness();
    const outcome = await calibrate(h.ok, h.deps);
    expect(outcome).toEqual({ kind: "completa", requests: 177 });
    expect(h.calls).toHaveLength(177);
    const [portada, nlogin, first, ...rest] = h.calls;
    expect(portada.url).toBe(PORTADA_URL);
    expect(portada.init).toEqual(portadaInit(USER_AGENT));
    // The Location of the portada, as the server gave it, query included.
    expect(nlogin.url).toBe(DOUBLE_NLOGIN);
    expect(nlogin.init).toEqual(nloginInit(COOKIE, USER_AGENT));
    expect(first.url).toBe(PANEL_URL);
    expect(first.init).toEqual(panelInit(COOKIE, USER_AGENT, PANEL_QUERY));
    const last = rest.pop() as Call;
    expect(last.init).toEqual(panelInit(COOKIE, USER_AGENT, PANEL_QUERY));
    for (const c of rest) {
      expect(c.url).toBe(PANEL_URL);
      expect(c.init).toEqual(
        panelInit(COOKIE, USER_AGENT, PANEL_ENJUEGO_QUERY),
      );
    }
    expect(perRound(h.lines).get(1)).toEqual([
      "GET portada ok",
      "GET nlogin ok",
      "POST todos ok",
    ]);
  });

  it("uses the constants and functions of adapter.ts", () => {
    expect(PANEL_ENJUEGO_QUERY).toBe(`${PANEL_QUERY}&Sch_en_juego=1`);
    expect(panelInit("X", USER_AGENT, PANEL_QUERY)).toEqual({
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: "JSESSIONID=X",
        "User-Agent": "marcador.gal (ingesta; https://marcador.gal)",
      },
      body: PANEL_QUERY,
    });
    expect(portadaInit(USER_AGENT)).toMatchObject({ redirect: "manual" });
    expect(nloginInit("X", USER_AGENT)).toEqual({
      method: "GET",
      redirect: "manual",
      headers: {
        Cookie: "JSESSIONID=X",
        "User-Agent": "marcador.gal (ingesta; https://marcador.gal)",
      },
    });
    // The opening is readPortada/readNlogin of adapter.ts, imported, not copied.
    const source = readFileSync(
      new URL("calibration.ts", import.meta.url),
      "utf8",
    );
    expect(source).toMatch(/readPortada\(/);
    expect(source).toMatch(/readNlogin\(/);
    expect(source).not.toMatch(/NLogin\?NSess/);
    // ADR-019 §6: the declared UA equals the registry's
    // (src/arch/rfef-identity.test.ts compares it from outside src/sources).
  });

  it.each([
    ["an NLogin body", () => new Response(LOGIN, { status: 200 })],
    ["a 3xx (the server forgot the session)", () => undefined],
  ])(
    "%s: opens again (portada, NLogin) and retries once; 4 requests; the series goes on with the new cookie",
    async (_, refused) => {
      const h = harness((c) => {
        if (c.n !== callOfRound(5)) return undefined; // the POST of round 5
        h.server.expire();
        return refused();
      });
      const outcome = await calibrate(h.ok, h.deps);
      expect(outcome.kind).toBe("completa");
      expect(perRound(h.lines).get(5)).toEqual([
        "POST enjuego nlogin",
        "GET portada ok",
        "GET nlogin ok",
        "POST enjuego ok",
      ]);
      const [, portada, nlogin, retry] = h.calls.slice(6, 10);
      expect(portada.init).toEqual(portadaInit(USER_AGENT));
      expect(nlogin.init).toEqual(nloginInit("RENOVADA42", USER_AGENT));
      expect(cookieOf(retry)).toBe("JSESSIONID=RENOVADA42");
      expect(cookieOf(posts(h.calls).at(-1) as Call)).toBe(
        "JSESSIONID=RENOVADA42",
      );
      expect(h.calls).toHaveLength(180);
    },
  );

  it("a second NLogin stops the series", async () => {
    const h = harness((c) =>
      c.n >= callOfRound(5) && c.init.method === "POST"
        ? new Response(LOGIN, { status: 200 })
        : undefined,
    );
    const outcome = await calibrate(h.ok, h.deps);
    expect(outcome).toMatchObject({ kind: "parada", result: "nlogin" });
    expect(h.calls).toHaveLength(callOfRound(5) + 3);
    expect(exitCode(outcome)).not.toBe(0);
  });

  it("the POST just after an opening is refused: stops, no renewal", async () => {
    const h = harness((c) =>
      c.init.method === "POST"
        ? new Response(null, { status: 302 })
        : undefined,
    );
    const outcome = await calibrate(h.ok, h.deps);
    expect(outcome).toMatchObject({ kind: "parada", result: "nlogin" });
    expect(h.calls.map((c) => c.init.method)).toEqual(["GET", "GET", "POST"]);
  });

  const r = (status: number, headers: Record<string, string>, body?: string) =>
    new Response(body ?? null, { status, headers });
  const SET = `JSESSIONID=${COOKIE}; Path=/pnfg; Secure; HttpOnly`;
  it.each([
    ["portada without Location", 1, r(302, { "set-cookie": SET })],
    ["portada without cookie", 1, r(302, { location: "/pnfg/NLogin?NSess=1" })],
    [
      "portada to another origin",
      1,
      r(302, {
        "set-cookie": SET,
        location: "https://otro.example/pnfg/NLogin",
      }),
    ],
    ["portada 200 with a body", 1, r(200, { "set-cookie": SET }, "<html>")],
    ["NLogin answering 200", 2, r(200, {}, "<html>login</html>")],
    ["NLogin back to NLogin", 2, r(302, { location: "/pnfg/NLogin" })],
  ])(
    "an opening that breaks ADR-020 §1 stops the series: %s",
    async (_, at, reply) => {
      const h = harness((c) => (c.n === at ? reply : undefined));
      const outcome = await calibrate(h.ok, h.deps);
      expect(h.calls).toHaveLength(at);
      expect(outcome).toMatchObject({ kind: "parada", result: "sin-sesion" });
      expect(exitCode(outcome)).not.toBe(0);
      expect(h.lines.at(-1)?.error).toMatch(/rfef session/);
    },
  );

  it("a renewal whose opening breaks ADR-020 §1 stops the series too", async () => {
    const h = harness((c) => {
      if (c.n === callOfRound(5)) {
        h.server.expire();
        return undefined;
      }
      if (c.n === callOfRound(5) + 2)
        return new Response("<html>login</html>", { status: 200 });
      return undefined;
    });
    const outcome = await calibrate(h.ok, h.deps);
    expect(outcome).toMatchObject({ kind: "parada", result: "sin-sesion" });
    expect(h.calls).toHaveLength(callOfRound(5) + 2);
  });

  it("never more than 4 requests per round: 3 when it opens, 4 when it renews, 1 otherwise", async () => {
    const h = harness((c) =>
      c.init.method === "POST" && c.n % 7 === 0
        ? new Response(LOGIN, { status: 200 })
        : undefined,
    );
    await calibrate(h.ok, h.deps);
    const sizes = [...perRound(h.lines).values()].map((l) => l.length);
    expect(sizes[0]).toBe(3);
    expect(Math.max(...sizes)).toBe(4);
    expect(new Set(sizes.slice(1))).toEqual(new Set([1, 4]));
  });
});

describe("CA-3 steps and permanence", () => {
  it("round starts are exactly the interval of their step apart, max(30 min, 10) per step, 3 h ≤ 4 h", async () => {
    const h = harness();
    await calibrate(h.ok, h.deps);
    const starts = roundStarts(h.lines);
    expect(starts).toHaveLength(175);
    const gaps = starts.slice(1).map((s, i) => (s - starts[i]) / 1000);
    expect(gaps).toEqual(
      planRounds(buildPlan())
        .slice(0, -1)
        .map((r) => r.intervalSeconds),
    );
    // Per step: count and duration.
    const perStep = new Map<number, number>();
    for (const l of h.lines.filter((x) => x.metodo === "POST"))
      perStep.set(l.escalon, (perStep.get(l.escalon) ?? 0) + 1);
    expect([...perStep.entries()]).toEqual([
      [180, 10],
      [120, 15],
      [90, 20],
      [60, 30],
      [45, 40],
      [30, 60],
    ]);
    const span = (starts[174] - starts[0]) / 1000 + 30;
    expect(span).toBe(3 * 3600);
    expect(span).toBeLessThanOrEqual(4 * 3600);
  });

  it("a slow request does not bring the next one forward, and never earlier", async () => {
    // Round 3 (180 s step) takes 200 s; round 12 (120 s step) takes 50 s.
    const slow: Record<number, number> = {
      [callOfRound(3)]: 200_000,
      [callOfRound(12)]: 50_000,
    };
    const h = harness();
    const fast = h.deps.fetch;
    h.deps.fetch = (async (url: string, init?: RequestInit) => {
      const n = h.calls.length + 1;
      const res = await fast(url, init);
      if (slow[n] !== undefined) await h.deps.sleep(slow[n]);
      return res;
    }) as typeof globalThis.fetch;
    await calibrate(h.ok, h.deps);
    const starts = roundStarts(h.lines);
    const gap = (n: number) => (starts[n] - starts[n - 1]) / 1000;
    expect(gap(3)).toBe(200); // round 4 waits for the end of round 3
    expect(gap(4)).toBe(180); // and then the interval again
    expect(gap(12)).toBe(120); // a request shorter than the interval: no change
    for (let n = 1; n < starts.length; n += 1)
      expect(gap(n)).toBeGreaterThanOrEqual(roundOf(n).intervalSeconds);
  });
});

describe("CA-4 stop at the first empty body", () => {
  it("the real empty 200: 0 more requests, the threshold logged, exit ≠ 0", async () => {
    const at = callOfRound(37); // round 37: step 90 s, 12th of the step
    const h = harness((c) =>
      c.n === at ? new Response(EMPTY, { status: 200 }) : undefined,
    );
    const outcome = await calibrate(h.ok, h.deps);
    expect(h.calls).toHaveLength(at);
    expect(outcome).toMatchObject({
      kind: "parada",
      result: "vacio",
      line: {
        escalon: 90,
        nEscalon: 12,
        vuelta: 37,
        bytes: 0,
        requestErrors: ["empty body"],
      },
    });
    expect(exitCode(outcome)).not.toBe(0);
    expect(h.logs.join("\n")).toMatch(
      /Umbral: primer vacío en el escalón de 90 s/,
    );
  });

  it.each([
    ["a non-2xx", () => new Response("no", { status: 503 }), "no-2xx"],
    ["a network error", () => "network" as const, "error-red"],
  ])("%s stops without retrying", async (_, reply, result) => {
    const at = callOfRound(20);
    const h = harness((c) => (c.n === at ? reply() : undefined));
    const outcome = await calibrate(h.ok, h.deps);
    expect(h.calls).toHaveLength(at);
    expect(outcome).toMatchObject({ kind: "parada", result });
    expect(exitCode(outcome)).not.toBe(0);
  });

  it("a stale body (same sha-256, ADR-018 §4) is logged and does not stop", async () => {
    const h = harness((c) =>
      c.n === callOfRound(30) || c.n === callOfRound(31)
        ? panelReply(ENJUEGO)
        : undefined,
    );
    const outcome = await calibrate(h.ok, h.deps);
    expect(outcome.kind).toBe("completa");
    const stale = h.lines.filter((l) => l.rancia);
    expect(stale.map((l) => l.vuelta)).toEqual([31]);
    expect(h.lines.find((l) => l.vuelta === 30)?.rancia).toBe(false);
  });
});

describe("CA-5 a free IP without provoking a block", () => {
  it.each([
    ["no --ultima-peticion", { lastRequest: null }],
    ["--ultima-peticion under 24 h", { lastRequest: "2026-10-16T15:00:01Z" }],
    ["--ultima-peticion not an instant", { lastRequest: "ayer" }],
    ["the last JSONL line under 24 h", { lastLogged: "2026-10-16T18:00:00Z" }],
  ])("%s: 0 requests", async (_, override) => {
    const h = harness();
    const outcome = await calibrate({ ...h.ok, ...override }, h.deps);
    expect(outcome.kind).toBe("rechazada");
    expect(exitCode(outcome)).not.toBe(0);
    expect(h.fetch).not.toHaveBeenCalled();
  });

  it("exactly 24 h of rest is enough (the rule is 'less than 24 h')", () => {
    expect(
      preconditions(
        {
          lastRequest: "2026-10-16T15:00:00Z",
          lastLogged: "2026-10-16T15:00:00Z",
        },
        CALENDAR,
        T0,
      ),
    ).toEqual([]);
  });

  it("the window of ADR-002 §2: kickoff − 10 to kickoff + 150 min", () => {
    const at = (kickoff: string) => [{ kickoff }];
    expect(inWindow(at("2026-10-17T15:10:00Z"), T0)).toBe(1);
    expect(inWindow(at("2026-10-17T15:10:01Z"), T0)).toBe(0);
    expect(inWindow(at("2026-10-17T12:30:00Z"), T0)).toBe(1);
    expect(inWindow(at("2026-10-17T12:29:59Z"), T0)).toBe(0);
  });

  it("no match of the five competitions in window: 0 requests", async () => {
    const h = harness();
    h.deps.calendar = [{ ...CALENDAR[0], kickoff: "2026-10-18T10:00:00Z" }];
    const outcome = await calibrate(h.ok, h.deps);
    expect(outcome).toMatchObject({
      kind: "rechazada",
      reasons: ["ningún partido de las cinco competiciones en ventana"],
    });
    expect(h.fetch).not.toHaveBeenCalled();
  });

  it("the first request is the probe: empty -> bloqueada-al-inicio, and 24 h before the next try", async () => {
    const h = harness(() => new Response(EMPTY, { status: 200 }));
    const outcome = await calibrate(h.ok, h.deps);
    expect(h.calls).toHaveLength(1);
    expect(outcome).toMatchObject({
      kind: "parada",
      result: "bloqueada-al-inicio",
    });
    expect(h.lines).toHaveLength(1);
    const again = harness();
    const retry = await calibrate(
      { ...again.ok, lastLogged: h.lines[0].inicio },
      { ...again.deps, now: () => T0 + 23 * 3600_000 },
    );
    expect(retry.kind).toBe("rechazada");
    expect(again.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["NLogin", 2],
    ["the panel", 3],
  ])(
    "an empty 200 of %s in round 1 after a good portada is also bloqueada-al-inicio",
    async (_, at) => {
      const h = harness((c) =>
        c.n === at ? new Response(EMPTY, { status: 200 }) : undefined,
      );
      const outcome = await calibrate(h.ok, h.deps);
      expect(outcome).toMatchObject({ result: "bloqueada-al-inicio" });
      expect(h.calls).toHaveLength(at);
    },
  );
});

describe("CA-6 a log with no secrets", () => {
  it("one line per request with every field; the body goes to the shell as received", async () => {
    const h = harness();
    await calibrate(h.ok, h.deps);
    expect(h.lines).toHaveLength(h.calls.length);
    const [portada, nlogin, todos, enjuego] = h.lines;
    expect(portada).toMatchObject({
      vuelta: 1,
      total: 1,
      variante: "portada",
      metodo: "GET",
      status: 302,
      resultado: "ok",
    });
    expect(nlogin).toMatchObject({
      vuelta: 1,
      total: 2,
      variante: "nlogin",
      metodo: "GET",
      status: 302,
      resultado: "ok",
    });
    expect(Object.keys(todos).sort()).toEqual(
      [
        "inicio",
        "escalon",
        "nEscalon",
        "vuelta",
        "total",
        "variante",
        "metodo",
        "status",
        "contentLength",
        "bytes",
        "sha256",
        "date",
        "filas",
        "observaciones",
        "requestErrors",
        "rancia",
        "resultado",
      ].sort(),
    );
    const body = Buffer.concat([TODOS, Buffer.from("<!-- 3 -->")]);
    expect(todos).toMatchObject({
      inicio: "2026-10-17T15:00:00.000Z",
      escalon: 180,
      nEscalon: 1,
      vuelta: 1,
      total: 3,
      variante: "todos",
      metodo: "POST",
      status: 200,
      bytes: body.length,
      sha256: createHash("sha256").update(body).digest("hex"),
      date: "Sat, 17 Oct 2026 15:00:00 GMT",
      requestErrors: [],
      rancia: false,
      resultado: "ok",
    });
    expect(todos.inicio).toMatch(/Z$/);
    expect(todos.filas).toBeGreaterThan(0);
    expect(enjuego).toMatchObject({ variante: "enjuego", total: 4 });
    expect(Buffer.from(h.bodies[2])).toEqual(body);
  });

  it("neither the cookie nor the Location of NLogin is in a line or a log (ADR-020 §4)", async () => {
    const h = harness((c) =>
      c.n === callOfRound(9) ? new Response(LOGIN, { status: 200 }) : undefined,
    );
    await calibrate(h.ok, h.deps);
    expect(h.calls.some((c) => cookieOf(c)?.includes(COOKIE))).toBe(true);
    const out = JSON.stringify(h.lines) + h.logs.join("\n");
    expect(out).not.toContain(COOKIE);
    expect(out).not.toMatch(/JSESSIONID/);
    expect(out).not.toContain("RENOVADA42");
    expect(out).not.toMatch(/NSess|\/pnfg\/NLogin/);
  });
});

describe("CA-9 boundaries", () => {
  const source = readFileSync(
    new URL("calibration.ts", import.meta.url),
    "utf8",
  );
  it("calibration.ts reads no clock, network or files, and imports only model and rfef", () => {
    expect(source).not.toMatch(/Date\.now|new Date\(\)|performance\.now/);
    expect(source).not.toMatch(/globalThis\.fetch|[^.]\bfetch\(/);
    expect(source).not.toMatch(/from "node:|require\(/);
    const imports = [...source.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
    for (const i of imports) expect(i).toMatch(/^(\.\.\/\.\.\/model\/|\.\/)/);
  });
});

describe("CA-7 report and recommendation (pure, on fixed JSONL)", () => {
  // A fixed JSONL: the lines a series writes, the first empty at round n.
  async function series(
    emptyAtRound: number | null,
  ): Promise<CalibrationLine[]> {
    const h = harness((c) =>
      emptyAtRound !== null && c.n === callOfRound(emptyAtRound)
        ? new Response(EMPTY, { status: 200 })
        : undefined,
    );
    await calibrate(h.ok, h.deps);
    return h.lines;
  }
  const firstOfStep = (interval: number) =>
    planRounds(buildPlan()).find((r) => r.intervalSeconds === interval)
      ?.index as number;
  const marked = (md: string) =>
    md.split("\n").filter((l) => l.startsWith("| **→**"));

  it("row ≤ 45 s: no threshold up to 30 s; sustainable 30, recommended 45", async () => {
    const lines = await series(null);
    expect(analyze(lines)).toMatchObject({
      kind: "medida",
      threshold: null,
      sustainable: 30,
      recommended: 45,
      row: "directo",
    });
    const md = buildReport(lines);
    expect(md).toContain("sin umbral hasta 30 s");
    expect(md).toMatch(/\*\*Recomendada \(C\\\*\): 45 s\*\*/);
    expect(marked(md)).toEqual([expect.stringContaining("≤ 45 s")]);
  });

  it("row 60 s – 3 min: empty at the 6th round of 45 s; sustainable 60, recommended 90; counts before the empty", async () => {
    const at = firstOfStep(45) + 5;
    const lines = await series(at);
    const a = analyze(lines);
    // The 6th round of 45 s starts 60 s after the last of 60 s plus 5 × 45 s.
    // Before it: 5 of 45 s, then the 60 s rounds at −285, −345… and the 90 s ones.
    expect(a).toMatchObject({
      kind: "medida",
      threshold: {
        step: 45,
        nInStep: 6,
        inStep: 5,
        last10: 5 + 6,
        last30: 5 + 26,
        last60: 5 + 30 + 17,
      },
      sustainable: 60,
      recommended: 90,
      row: "sen-sinal",
    });
    const md = buildReport(lines);
    expect(md).toMatch(/Umbral: escalón de 45 s/);
    expect(marked(md)).toEqual([expect.stringContaining("60 s – 3 min")]);
  });

  it("row sin cadencia: empty within the first step (180 s)", async () => {
    const lines = await series(4);
    expect(analyze(lines)).toMatchObject({
      sustainable: null,
      recommended: null,
      row: "sin-cadencia",
    });
    const md = buildReport(lines);
    expect(md).toContain("sin cadencia sostenible");
    expect(marked(md)).toEqual([expect.stringContaining("sin cadencia")]);
  });

  it("row sin cadencia: only 180 s held, and there is no slower step for the margin", async () => {
    const lines = await series(firstOfStep(120) + 2);
    expect(analyze(lines)).toMatchObject({
      sustainable: 180,
      recommended: null,
      row: "sin-cadencia",
    });
    expect(marked(buildReport(lines))).toEqual([
      expect.stringContaining("sin cadencia"),
    ]);
  });

  it("bloqueada-al-inicio: no measure, no row marked, CA-8 stays open", async () => {
    const h = harness(() => new Response(EMPTY, { status: 200 }));
    await calibrate(h.ok, h.deps);
    expect(analyze(h.lines)).toMatchObject({
      kind: "bloqueada-al-inicio",
      row: null,
    });
    const md = buildReport(h.lines);
    expect(md).toContain("bloqueada-al-inicio");
    expect(marked(md)).toEqual([]);
  });

  it("a series stopped without an empty (non-2xx) has no threshold and is not 'sin umbral hasta 30 s'", async () => {
    const h = harness((c) =>
      c.n === callOfRound(firstOfStep(60) + 3)
        ? new Response("x", { status: 500 })
        : undefined,
    );
    await calibrate(h.ok, h.deps);
    expect(analyze(h.lines)).toMatchObject({
      threshold: null,
      sustainable: 90,
      recommended: 120,
      stop: "no-2xx",
    });
    expect(buildReport(h.lines)).not.toContain("sin umbral hasta 30 s");
  });
});

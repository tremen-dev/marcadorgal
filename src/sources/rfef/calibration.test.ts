import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { AliasFile } from "../../model/index.ts";
import { sourceConfig } from "../registry.ts";
import {
  PANEL_ENJUEGO_QUERY,
  PANEL_QUERY,
  PANEL_URL,
  PORTADA_URL,
  panelInit,
  portadaInit,
  USER_AGENT,
} from "./adapter.ts";
import {
  buildPlan,
  type CalendarMatch,
  type CalibrateDeps,
  type CalibrationLine,
  calibrate,
  exitCode,
  formatPlan,
  planRounds,
} from "./calibration.ts";
import { EMPTY_BODY_FILE, fixtureBytes } from "./fixture-files.ts";

// SPEC-032: the calibration of the RFEF cadence. Every test runs against a
// fetch double: no request ever leaves for marcadores.rfef.es.

const noFetch = () =>
  vi.fn(async (): Promise<Response> => {
    throw new Error("no request may leave in this test");
  });

describe("CA-1 dry-run plan", () => {
  it("has the six steps, max(30 min, 10 requests) each, ~175 rounds and ~3 h", () => {
    const plan = buildPlan();
    expect(plan.steps.map((s) => s.intervalSeconds)).toEqual([
      180, 120, 90, 60, 45, 30,
    ]);
    expect(plan.steps.map((s) => s.rounds)).toEqual([10, 15, 20, 30, 40, 60]);
    expect(plan.steps.map((s) => s.seconds)).toEqual(Array(6).fill(1800));
    expect(plan.rounds).toBe(175);
    // One portada for the session on top of one POST per round.
    expect(plan.maxRequests).toBe(176);
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
    expect(text).toMatch(/176/);
    expect(text).toMatch(/3 h/);
  });
});

// ---- Harness: a fetch double and a fake clock -------------------------------

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
const TODOS = fixtureBytes("campo-post-2026-10-11T15-00-15Z-todos.raw.gz");
const ENJUEGO = fixtureBytes("paneles-fed3-enjuego-2026-10-10T21-33-30Z.raw");
const LOGIN = readFileSync(
  new URL("fixtures/sin-cookie-aceptada.html", import.meta.url),
);
const EMPTY = fixtureBytes(EMPTY_BODY_FILE);
const CT = "text/html;charset=ISO-8859-15";

type Call = { url: string; init: RequestInit; at: number; n: number };
type Reply = Response | "network" | { response: Response; takesMs: number };

const portadaReply = (cookie = COOKIE) =>
  new Response(null, {
    status: 302,
    headers: { "set-cookie": `JSESSIONID=${cookie}; Path=/pnfg` },
  });
const panelReply = (bytes: Uint8Array, salt = "") =>
  new Response(
    salt === "" ? bytes : Buffer.concat([bytes, Buffer.from(salt)]),
    {
      status: 200,
      headers: {
        "content-type": CT,
        date: "Sat, 17 Oct 2026 15:00:00 GMT",
      },
    },
  );

// Fresh bodies by default: real fixtures with a salt, so no two repeat.
const fresh = (call: Call): Reply =>
  call.init.method === "GET"
    ? portadaReply()
    : panelReply(
        String(call.init.body).endsWith("Sch_en_juego=1") ? ENJUEGO : TODOS,
        `<!-- ${call.n} -->`,
      );

function harness(script: (call: Call) => Reply | undefined = () => undefined) {
  let t = T0;
  const calls: Call[] = [];
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
      const reply = script(call) ?? fresh(call);
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
  return { calls, lines, bodies, logs, fetch, deps, ok, now: () => t };
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
// The n-th POST of a run with no renewals is round n.

describe("CA-2 the production pattern (ADR-019 §1-§2)", () => {
  it("round 1: portada + POST todos; then one POST Sch_en_juego=1 with the same cookie; last: POST todos", async () => {
    const h = harness();
    const outcome = await calibrate(h.ok, h.deps);
    expect(outcome).toEqual({ kind: "completa", requests: 176 });
    expect(h.calls).toHaveLength(176);
    const [portada, first, ...rest] = h.calls;
    expect(portada.url).toBe(PORTADA_URL);
    expect(portada.init).toEqual(portadaInit(USER_AGENT));
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
  });

  it("uses the constants of adapter.ts and the UA of the registry", () => {
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
    // ADR-019 §6: the declared identity is the UA of the registry.
    expect(USER_AGENT).toBe(sourceConfig("api-football")?.userAgent);
  });

  it.each([
    ["an NLogin body", () => new Response(LOGIN, { status: 200 })],
    ["a 3xx", () => new Response(null, { status: 302 })],
  ])(
    "%s: one portada and one retry; the series goes on with the new cookie",
    async (_, refused) => {
      let renewed = false;
      const h = harness((c) => {
        if (c.init.method === "GET" && c.n > 1) {
          renewed = true;
          return portadaReply("RENOVADA42");
        }
        if (c.n === 6) return refused(); // the POST of round 5
        return undefined;
      });
      const outcome = await calibrate(h.ok, h.deps);
      expect(outcome.kind).toBe("completa");
      expect(renewed).toBe(true);
      expect(h.calls.slice(5, 8).map((c) => c.init.method)).toEqual([
        "POST",
        "GET",
        "POST",
      ]);
      // Round 5: refused POST, portada, retry; nothing else in that round.
      const round5 = h.lines.filter((l) => l.vuelta === 5);
      expect(round5.map((l) => `${l.metodo} ${l.resultado}`)).toEqual([
        "POST nlogin",
        "GET ok",
        "POST ok",
      ]);
      expect(cookieOf(h.calls[7])).toBe("JSESSIONID=RENOVADA42");
      expect(cookieOf(posts(h.calls).at(-1) as Call)).toBe(
        "JSESSIONID=RENOVADA42",
      );
      expect(h.calls).toHaveLength(178);
    },
  );

  it("a second NLogin stops the series", async () => {
    const h = harness((c) =>
      c.n >= 6 && c.init.method === "POST"
        ? new Response(LOGIN, { status: 200 })
        : undefined,
    );
    const outcome = await calibrate(h.ok, h.deps);
    expect(outcome).toMatchObject({ kind: "parada", result: "nlogin" });
    expect(h.calls).toHaveLength(8);
    expect(exitCode(outcome)).not.toBe(0);
  });

  it("a session just opened that is refused stops: never more than 3 requests per round", async () => {
    const h = harness((c) =>
      c.init.method === "POST"
        ? new Response(null, { status: 302 })
        : undefined,
    );
    const outcome = await calibrate(h.ok, h.deps);
    expect(outcome).toMatchObject({ kind: "parada", result: "nlogin" });
    expect(h.calls.map((c) => c.init.method)).toEqual(["GET", "POST"]);
  });

  it("never more than 3 requests per round", async () => {
    const h = harness((c) =>
      c.init.method === "POST" && c.n % 7 === 0
        ? new Response(LOGIN, { status: 200 })
        : undefined,
    );
    await calibrate(h.ok, h.deps);
    const perRound = new Map<number, number>();
    for (const l of h.lines)
      perRound.set(l.vuelta, (perRound.get(l.vuelta) ?? 0) + 1);
    expect(Math.max(...perRound.values())).toBeLessThanOrEqual(3);
    expect(Math.max(...perRound.values())).toBe(3);
  });
});

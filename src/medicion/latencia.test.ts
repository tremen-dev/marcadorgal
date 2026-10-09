import { describe, expect, it } from "vitest";
import {
  type LatDecision,
  type LatenciaInput,
  type LatObservation,
  medirLatencia,
} from "./latencia.ts";
import { parseSonda } from "./sonda.ts";

// SPEC-025 CA-4: every stretch in its own clock, joined per goal. Pure.
const T0 = Date.parse("2026-10-17T16:00:00.000Z");
const t = (seconds: number) => new Date(T0 + seconds * 1000).toISOString();

const obs = (
  id: string,
  matchId: string,
  s: number,
  total: number,
): LatObservation => ({
  id,
  matchId,
  observedAt: t(s),
  total,
  rawRef: `raw/${id}`,
});
const dec = (
  matchId: string,
  version: number,
  total: number | null,
  cites: string[],
  recorded: number | null,
): LatDecision => ({
  id: `${matchId}-v${version}`,
  matchId,
  version,
  total,
  decidedAt: t(recorded ?? 0),
  recordedAt: recorded === null ? null : t(recorded),
  observationIds: cites,
});

const sondaJsonl = (lines: object[]) =>
  parseSonda(lines.map((l) => JSON.stringify(l)).join("\n"), "a.jsonl");
const pintura = (
  matchId: string,
  version: number,
  s: number,
  inicial = false,
) => ({
  tipo: "pintura",
  ruta: "/",
  matchId,
  version,
  marcador: null,
  estado: "live",
  paintedAt: t(s),
  inicial,
});

const MATCHES = ["m1", "m2", "m3", "m4", "m5"].map((id) => ({
  id,
  competitionId: id === "m1" ? "segunda-division" : "tercera-rfef-g1",
}));

function input(): LatenciaInput {
  return {
    matches: MATCHES,
    observations: [
      // m1: 0-0, 0-0, 1-0 (the goal comes in at +60 s)
      obs("o0", "m1", 0, 0),
      obs("o1", "m1", 30, 0),
      obs("o2", "m1", 60, 1),
      // m2: a goal that the source takes back, then the real one
      obs("p0", "m2", 0, 0),
      obs("p1", "m2", 30, 1),
      obs("p2", "m2", 60, 0),
      obs("p3", "m2", 90, 0),
      obs("p4", "m2", 120, 1),
      // m3: a goal the provider has no event for
      obs("q0", "m3", 0, 0),
      obs("q1", "m3", 30, 1),
      // m5: a goal before the probe opened
      obs("s0", "m5", 0, 1),
    ],
    decisions: [
      dec("m1", 1, 0, ["o0"], 1.5),
      dec("m1", 2, 1, ["o2"], 61.5),
      dec("m2", 1, 0, ["p0"], 1),
      dec("m2", 2, 1, ["p1"], 31),
      dec("m2", 3, 0, ["p2"], 61),
      dec("m2", 4, 1, ["p4"], 121),
      dec("m3", 1, 1, ["q1"], null),
      dec("m5", 1, 1, ["s0"], 1),
    ],
    attempts: [
      { rawRef: "raw/o2", startedAt: t(60), openedAt: t(60.4) },
      { rawRef: "raw/o1", startedAt: t(30), openedAt: t(30.2) },
      { rawRef: "raw/q1", startedAt: t(30), openedAt: null },
    ],
    rawObjects: [{ rawRef: "raw/o2", createdAt: t(61.2) }],
    referencias: [
      {
        matchId: "m1",
        order: 1,
        interval: { from: t(10), to: t(70) },
        reason: null,
      },
      {
        matchId: "m2",
        order: 1,
        interval: { from: t(100), to: t(160) },
        reason: null,
      },
      { matchId: "m4", order: 1, interval: null, reason: "no_periods" },
    ],
    calibracion: [{ matchId: "m1", gol: 1, instante: t(35) }],
    sonda: sondaJsonl([
      pintura("m5", 1, -10, true),
      {
        tipo: "respuesta",
        ruta: "/",
        estado: 200,
        age: "5",
        xVercelCache: "HIT",
        date: new Date(T0 + 79_000).toUTCString(),
        instante: t(79.9),
      },
      pintura("m1", 2, 80),
    ]),
  };
}

describe("SPEC-025 CA-4 one goal, every stretch in its clock", () => {
  const { goles } = medirLatencia(input());
  const m1 = goles.find((g) => g.matchId === "m1");

  it("joins reference ↔ the first Decision with total k ↔ the first paint with version ≥ its own", () => {
    expect(m1).toMatchObject({
      k: 1,
      estado: "valido",
      competitionId: "segunda-division",
      version: 2,
      referencia: { from: t(10), to: t(70) },
      pintura: { paintedAt: t(80), version: 2, ruta: "/" },
    });
  });

  it("(a) sampling: first observation with the goal − last without it, tick clock", () => {
    expect(m1?.tramos.muestreo).toBe(30_000);
  });

  it("(b) request + raw: storage.objects.created_at − opened_at, base clock", () => {
    expect(m1?.tramos.peticionCrudo).toBe(800);
  });

  it("(c) parse + insert + engine: recorded_at − created_at, base clock", () => {
    expect(m1?.tramos.parseMotor).toBe(300);
  });

  it("(d) delivery: paintedAt − recorded_at, split into Age (CDN) and the polling wait", () => {
    expect(m1?.tramos.entrega).toBe(18_500);
    expect(m1?.tramos.cdn).toBe(5_000);
    expect(m1?.tramos.espera).toBe(13_500);
    expect(m1?.respuesta).toMatchObject({ age: 5, xVercelCache: "HIT" });
  });

  it("(e) total: paintedAt − the middle of the provider's interval; and against the manual instant", () => {
    expect(m1?.tramos.total).toBe(40_000);
    expect(m1?.tramos.totalManual).toBe(45_000);
    expect(m1?.manual).toBe(t(35));
  });

  it("residue = sum of the stretches − total", () => {
    expect(m1?.tramos.residuo).toBe(30_000 + 800 + 300 + 18_500 - 40_000);
    expect(m1?.motivos).toEqual([]);
  });
});

describe("SPEC-025 CA-4 no goal is dropped in silence", () => {
  const { goles } = medirLatencia(input());
  const of = (matchId: string) => goles.filter((g) => g.matchId === matchId);

  it("a disallowed goal (RN-03 lowered it) is kept as anulado, with no reference; the real one gets it", () => {
    const m2 = of("m2");
    expect(m2.map((g) => [g.estado, g.version, g.k])).toEqual([
      ["anulado", 2, 1],
      ["valido", 4, 1],
    ]);
    expect(m2[0].referencia).toBeNull();
    expect(m2[0].motivos).toContain("anulado: bajada en v3");
    expect(m2[1].referencia).toEqual({ from: t(100), to: t(160) });
    // The sampling of the real one starts after the lowering.
    expect(m2[1].tramos.muestreo).toBe(30_000);
  });

  it("a goal with no paint keeps its stretches and says why it has no delivery nor total", () => {
    const [real] = of("m2").filter((g) => g.estado === "valido");
    expect(real.pintura).toBeNull();
    expect(real.tramos.entrega).toBeNull();
    expect(real.tramos.total).toBeNull();
    expect(real.motivos).toContain("sin pintura");
  });

  it("a goal with no provider event: sin referencia, and the base stretches it lacks say so", () => {
    const [m3] = of("m3");
    expect(m3.estado).toBe("valido");
    expect(m3.referencia).toBeNull();
    expect(m3.motivos).toEqual(
      expect.arrayContaining([
        "sin referencia",
        "sin opened_at",
        "sin crudo en storage",
        "sin recorded_at",
      ]),
    );
  });

  it("a provider goal that no Decision ever published", () => {
    const [m4] = of("m4");
    expect(m4).toMatchObject({ estado: "sin_decision", k: 1, version: null });
    expect(m4.motivos).toEqual(
      expect.arrayContaining([
        "sin Decision",
        "referencia sin intervalo: no_periods",
      ]),
    );
  });

  it("a goal already on screen when the probe opened is not a delivery", () => {
    const [m5] = of("m5");
    expect(m5.pintura).toBeNull();
    expect(m5.motivos).toContain("anterior a la sonda");
  });

  it("and nothing else: five matches, six goals", () => {
    expect(goles).toHaveLength(6);
  });
});

describe("SPEC-025 CA-4 the joints, printed", () => {
  const { juntas } = medirLatencia(input());

  it("tick ↔ base: median (nearest rank) of opened_at − started_at", () => {
    expect(juntas.tickBase).toEqual({ mediana: 200, n: 2 });
  });

  it("base ↔ probe: median of the local instant − the Date header (±1 s)", () => {
    expect(juntas.baseSonda).toEqual({
      mediana: 900,
      n: 1,
      resolucionMs: 1000,
    });
  });

  it("residue: median over the goals that have it", () => {
    expect(juntas.residuo).toEqual({ mediana: 9_600, n: 1 });
  });
});

describe("SPEC-025 CA-4 latencia.ts is pure", () => {
  it("reads no clock, asks no network and opens no database", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(
      new URL("./latencia.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(
      /Date\.now\(|new Date\(\)|performance\.now|fetch\(|postgres|from "\.\.\/db/,
    );
    expect(source).not.toMatch(/nowInstant|clock\.ts/);
  });
});

describe("SPEC-025 CA-2/CA-4 rawRefsDeReferencia", () => {
  it("the newest capture of each match and the newest one where it was live, once each", async () => {
    const { rawRefsDeReferencia } = await import("./latencia.ts");
    const o = (
      matchId: string,
      s: number,
      status: string,
      rawRef: string,
      total: number | null = null,
    ) => ({
      matchId,
      observedAt: t(s),
      status,
      rawRef,
      total,
    });
    expect(
      rawRefsDeReferencia([
        o("m1", 0, "live", "raw/a"),
        o("m1", 30, "live", "raw/b"),
        o("m1", 60, "finished", "raw/c"),
        o("m2", 30, "live", "raw/b"),
        o("m3", 10, "scheduled", "raw/d"),
      ]),
    ).toEqual(["raw/b", "raw/c", "raw/d"]);
  });

  it("V-1: also the newest capture of each score, so a goal whose events only came live is read", async () => {
    const { rawRefsDeReferencia } = await import("./latencia.ts");
    const o = (s: number, status: string, rawRef: string, total: number) => ({
      matchId: "m1",
      observedAt: t(s),
      status,
      rawRef,
      total,
    });
    expect(
      rawRefsDeReferencia([
        o(0, "live", "raw/a", 0),
        o(10, "live", "raw/b", 0),
        o(20, "live", "raw/c", 1),
        o(30, "live", "raw/d", 1),
        // Late goal seen first at FT (events: [] in that body) and a second
        // FT capture; the newest live one is raw/e with the 2-0.
        o(40, "live", "raw/e", 2),
        o(50, "finished", "raw/f", 3),
        o(60, "finished", "raw/g", 3),
      ]),
    ).toEqual(["raw/b", "raw/d", "raw/e", "raw/g"]);
  });
});

describe("SPEC-025 CA-4 a response with no Age", () => {
  it("spent no time in the CDN: cdn 0, the whole delivery is the wait, and it says so", () => {
    const base = input();
    const sonda = sondaJsonl([
      {
        tipo: "respuesta",
        ruta: "/",
        estado: 200,
        age: null,
        xVercelCache: "MISS",
        date: new Date(T0 + 79_000).toUTCString(),
        instante: t(79.9),
      },
      pintura("m1", 2, 80),
    ]);
    const m1 = medirLatencia({ ...base, sonda }).goles.find(
      (g) => g.matchId === "m1",
    );
    expect(m1?.tramos.cdn).toBe(0);
    expect(m1?.tramos.espera).toBe(18_500);
    expect(m1?.motivos).toEqual(["respuesta sin Age: CDN 0 s"]);
  });
});

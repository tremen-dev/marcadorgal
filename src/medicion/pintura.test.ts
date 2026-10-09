import { describe, expect, it } from "vitest";
import {
  type CrudoPasada,
  filasEnHtml,
  informePintura,
  type Pasada,
  type Perfil,
  pasada,
  resumenRuta,
  UMBRAL_FCP_MS,
  veredicto,
} from "./pintura";

// SPEC-026 CA-2, CA-3 and CA-4: the arithmetic of the first paint, pure.

const PERFIL: Perfil = {
  nombre: "3G (WebPageTest)",
  bajadaKbps: 1600,
  subidaKbps: 768,
  rttMs: 300,
  cpu: 4,
  ancho: 390,
  alto: 844,
  dpr: 3,
  movil: true,
};

const fila = (id: string, margen: string, marcador: [string, string]) =>
  `<li class="r" data-testid="match-row" data-match-id="${id}" data-status="live">` +
  `<div><span class="m" data-testid="match-margin"><span class="dot" aria-hidden="true"></span>${margen}</span></div>` +
  `<div><span data-testid="team-name">A</span><span class="s" data-testid="score">${marcador[0]}</span>` +
  `<span data-testid="team-name">B</span><span class="s" data-testid="score">${marcador[1]}</span></div></li>`;

describe("SPEC-026 CA-2 filasEnHtml (the datum is in the served HTML)", () => {
  it("counts a row with a score", () => {
    expect(
      filasEnHtml(`<ul>${fila("a", "46&#x27;", ["2", "1"])}</ul>`),
    ).toEqual({ filas: 1, conDato: 1 });
  });

  it("counts a scheduled row by its kickoff time", () => {
    expect(filasEnHtml(fila("a", "21:00", ["–", "–"]))).toEqual({
      filas: 1,
      conDato: 1,
    });
  });

  it("does not count a row with neither score nor time", () => {
    expect(filasEnHtml(fila("a", "Aprazado", ["–", "–"]))).toEqual({
      filas: 1,
      conDato: 0,
    });
  });

  it("tolerates React's text separators", () => {
    expect(
      filasEnHtml(fila("a", "21<!-- -->:<!-- -->00", ["–", "–"])).conDato,
    ).toBe(1);
  });

  it("finds nothing in the unavailable page", () => {
    expect(
      filasEnHtml(
        '<main><p data-testid="xornada-unavailable">Non dispoñibles</p></main>',
      ),
    ).toEqual({ filas: 0, conDato: 0 });
  });
});

const crudo = (over: Partial<CrudoPasada> = {}): CrudoPasada => ({
  ruta: "/",
  inicio: "2026-10-18T17:00:00.000Z",
  status: 200,
  cabeceras: { xVercelCache: "HIT", age: "4" },
  filas: { filas: 12, conDato: 12 },
  navegacion: {
    responseStart: 700,
    responseEnd: 1100,
    transferSize: 21_000,
    encodedBodySize: 20_500,
    domContentLoadedEventEnd: 1900,
  },
  fcpMs: 1500,
  lcpMs: 1600,
  primeraFilaMs: 800,
  recursos: [
    {
      name: "https://marcador.gal/_next/static/chunks/a.js",
      startTime: 1150,
      transferSize: 60_000,
      encodedBodySize: 59_000,
    },
    {
      name: "https://marcador.gal/_next/static/chunks/b.css?v=1",
      startTime: 1120,
      transferSize: 8_000,
      encodedBodySize: 7_500,
    },
    // After DOMContentLoaded: not initial.
    {
      name: "https://marcador.gal/_next/static/chunks/late.js",
      startTime: 2500,
      transferSize: 99_000,
      encodedBodySize: 99_000,
    },
    {
      name: "https://marcador.gal/api/board",
      startTime: 1300,
      transferSize: 3_000,
      encodedBodySize: 3_000,
    },
  ],
  ttfbRedMs: null,
  error: null,
  ...over,
});

describe("SPEC-026 CA-2 pasada (one pass from its raw capture)", () => {
  it("derives the times, bytes and cache of a good pass", () => {
    expect(pasada(crudo())).toEqual({
      ruta: "/",
      inicio: "2026-10-18T17:00:00.000Z",
      ttfbMs: 700,
      transferenciaMs: 400,
      renderMs: 400,
      fcpMs: 1500,
      lcpMs: 1600,
      bytesDocumento: 21_000,
      bytesJs: 60_000,
      bytesCss: 8_000,
      cache: "HIT",
      ageS: 4,
      filasEnHtml: 12,
      datoEnHtml: true,
      filasAlFcp: true,
      fallo: null,
    } satisfies Pasada);
  });

  it("a pass without rows in the HTML is a failure, not discarded", () => {
    const p = pasada(crudo({ filas: { filas: 0, conDato: 0 } }));
    expect(p.datoEnHtml).toBe(false);
    expect(p.fallo).toBe("sin dato en el HTML");
    expect(p.fcpMs).toBe(1500);
  });

  it("rows that reach the DOM after the first paint are a failure", () => {
    const p = pasada(crudo({ primeraFilaMs: 1700 }));
    expect(p.filasAlFcp).toBe(false);
    expect(p.fallo).toBe("FCP sin filas en el DOM");
  });

  it("no rows in the DOM at all is a failure too", () => {
    expect(pasada(crudo({ primeraFilaMs: null })).filasAlFcp).toBe(false);
  });

  it("an error, a non-200 or a missing FCP are failures", () => {
    expect(pasada(crudo({ error: "timeout" })).fallo).toBe("error: timeout");
    expect(pasada(crudo({ status: 503 })).fallo).toBe("HTTP 503");
    expect(pasada(crudo({ fcpMs: null })).fallo).toBe("sin FCP");
  });

  // Navigation Timing does not see the latency CDP adds (responseStart stays
  // at a few ms against localhost); the CDP response of the document does.
  it("takes the TTFB of the emulated network when CDP saw it", () => {
    const p = pasada(crudo({ ttfbRedMs: 1000 }));
    expect(p.ttfbMs).toBe(1000);
    expect(p.transferenciaMs).toBe(100);
    expect(p.renderMs).toBe(400);
  });

  it("never prints a negative transfer", () => {
    expect(pasada(crudo({ ttfbRedMs: 1200 })).transferenciaMs).toBe(0);
  });

  it("falls back to the encoded size when the transfer size is zero", () => {
    const c = crudo();
    if (c.navegacion) c.navegacion.transferSize = 0;
    expect(pasada(c).bytesDocumento).toBe(20_500);
  });

  it("a missing Age or cache header is null", () => {
    const p = pasada(crudo({ cabeceras: { xVercelCache: null, age: null } }));
    expect(p.cache).toBeNull();
    expect(p.ageS).toBeNull();
  });
});

const conFcp = (ruta: string, fcps: (number | null)[]): Pasada[] =>
  fcps.map((fcpMs) => pasada(crudo({ ruta, fcpMs, lcpMs: fcpMs })));

const veinte = (fcp: number) => Array.from({ length: 20 }, () => fcp);

describe("SPEC-026 CA-3 resumenRuta (p75 per route, threshold 2000 ms)", () => {
  it("prints median, p75, maximum and n, nearest rank", () => {
    const r = resumenRuta("/", conFcp("/", [1000, 1200, 1400, 1600]));
    expect(r).toMatchObject({
      ruta: "/",
      n: 4,
      fallos: 0,
      mediana: 1200,
      p75: 1400,
      maximo: 1600,
      cumple: true,
    });
  });

  it.each([
    [UMBRAL_FCP_MS - 1, true],
    [UMBRAL_FCP_MS, false],
    [UMBRAL_FCP_MS + 1, false],
  ])("p75 = %i ms → cumple %s (strictly below)", (fcp, cumple) => {
    expect(resumenRuta("/", conFcp("/", veinte(fcp))).cumple).toBe(cumple);
  });

  it("one pass without the datum sinks a route with a fast p75", () => {
    const pasadas = conFcp("/", veinte(900));
    pasadas[7] = pasada(crudo({ fcpMs: 900, filas: { filas: 0, conDato: 0 } }));
    const r = resumenRuta("/", pasadas);
    expect(r.p75).toBe(900);
    expect(r.fallos).toBe(1);
    expect(r.cumple).toBe(false);
  });

  it("a pass that never painted counts as infinitely slow", () => {
    const r = resumenRuta("/", conFcp("/", [1000, null]));
    expect(r.maximo).toBe(Number.POSITIVE_INFINITY);
    expect(r.cumple).toBe(false);
  });

  it("counts the CDN cache outcomes of the document", () => {
    const pasadas = [
      pasada(crudo({ cabeceras: { xVercelCache: "HIT", age: "1" } })),
      pasada(crudo({ cabeceras: { xVercelCache: "MISS", age: null } })),
      pasada(crudo({ cabeceras: { xVercelCache: "HIT", age: "9" } })),
      pasada(crudo({ cabeceras: { xVercelCache: null, age: null } })),
    ];
    expect(resumenRuta("/", pasadas).cache).toEqual({
      HIT: 2,
      MISS: 1,
      "(sin cabecera)": 1,
    });
  });

  it("names the dominant stretch when it does not comply", () => {
    const lento = (ttfb: number, end: number, fcp: number) =>
      pasada(
        crudo({
          fcpMs: fcp,
          primeraFilaMs: 10,
          navegacion: {
            responseStart: ttfb,
            responseEnd: end,
            transferSize: 1,
            encodedBodySize: 1,
            domContentLoadedEventEnd: fcp,
          },
        }),
      );
    expect(resumenRuta("/", [lento(1800, 2000, 2500)]).tramo).toBe("TTFB");
    expect(resumenRuta("/", [lento(300, 2000, 2500)]).tramo).toBe(
      "transferencia",
    );
    expect(resumenRuta("/", [lento(300, 600, 2500)]).tramo).toBe("render");
    expect(resumenRuta("/", [lento(300, 600, 900)]).tramo).toBeNull();
  });
});

describe("SPEC-026 CA-3 veredicto (each route, valid sample)", () => {
  const opciones = { pausaS: 15, nObjetivo: 20, rutas: ["/", "/es"] };

  it("complies when both routes comply", () => {
    const v = veredicto(
      [
        resumenRuta("/", conFcp("/", veinte(1500))),
        resumenRuta("/es", conFcp("/es", veinte(1999))),
      ],
      opciones,
    );
    expect(v).toEqual({ estado: "cumple", motivos: [] });
  });

  it("one route yes and the other no → does not comply, naming it", () => {
    const v = veredicto(
      [
        resumenRuta("/", conFcp("/", veinte(1500))),
        resumenRuta("/es", conFcp("/es", veinte(2000))),
      ],
      opciones,
    );
    expect(v.estado).toBe("no-cumple");
    expect(v.motivos).toEqual(["/es: p75 2000 ms ≥ 2000 ms"]);
  });

  it("a pass without the datum → does not comply", () => {
    const es = conFcp("/es", veinte(1000));
    es[0] = pasada(crudo({ ruta: "/es", filas: { filas: 0, conDato: 0 } }));
    const v = veredicto(
      [resumenRuta("/", conFcp("/", veinte(1000))), resumenRuta("/es", es)],
      opciones,
    );
    expect(v).toEqual({
      estado: "no-cumple",
      motivos: ["/es: 1 pasada(s) con fallo"],
    });
  });

  it("a short pause, a small n or a missing route make the sample invalid", () => {
    const uno = [resumenRuta("/", conFcp("/", [1000]))];
    const v = veredicto(uno, { ...opciones, pausaS: 0 });
    expect(v.estado).toBe("no-valida");
    expect(v.motivos).toEqual([
      "pausa 0 s < 15 s",
      "/: n = 1 < 20",
      "/es: sin pasadas",
    ]);
  });
});

describe("SPEC-026 CA-4 informePintura (one page of Markdown)", () => {
  const md = informePintura({
    inicio: "2026-10-18T17:00:00.000Z",
    fin: "2026-10-18T17:12:00.000Z",
    url: "https://marcador.gal",
    perfil: PERFIL,
    navegador: "Chromium 140.0",
    pausaS: 15,
    nObjetivo: 20,
    rutas: ["/", "/es"],
    pasadas: [...conFcp("/", veinte(1500)), ...conFcp("/es", veinte(2400))],
    json: "primera-pintura-2026-10-18T17-00.json",
  });

  it("copies the CA-1 profile", () => {
    expect(md).toContain(
      "red 1600 kbit/s de bajada, 768 kbit/s de subida, RTT 300 ms",
    );
    expect(md).toContain("CPU ×4");
    expect(md).toContain("390 × 844, DPR 3, isMobile");
    expect(md).toContain("Chromium 140.0");
  });

  it("prints the per-route table and the verdict", () => {
    expect(md).toContain("**Veredicto: NO CUMPLE**");
    expect(md).toMatch(/\| \/ \| 20 \| 1500 \| 1500 \| 1500 \| 0 \|/);
    expect(md).toMatch(/\| \/es \| 20 \| 2400 \| 2400 \| 2400 \| 0 \|/);
    expect(md).toContain("HIT 20");
  });

  it("says where the time goes when it does not comply", () => {
    expect(md).toContain("## Dónde se va el tiempo");
    expect(md).toMatch(/\/es: render/);
  });

  it("points at the raw JSON and fits on one page", () => {
    expect(md).toContain("primera-pintura-2026-10-18T17-00.json");
    expect(md.split("\n").length).toBeLessThan(60);
  });
});

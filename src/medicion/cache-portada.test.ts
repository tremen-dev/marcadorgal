import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ESPERA_S,
  frescuraEnHtml,
  juzgar,
  leerJsonl,
  type RespuestaPortada,
  RONDAS,
  veredicto,
} from "./cache-portada";

// SPEC-030 CA-4. The fixture comes from the 2026-10-10 survey
// (docs/epicas/EPIC-FIX/_qa/SPEC-030/2026-10-10-tras-inactividad.txt and
// sondeo-2026-10-10.md §3, §5), one line per response:
//   1  idle65-r1-a       PRERENDER «ás 17:38», 7 min old      → fails
//   2  idle65-r1-b       HIT «ás 17:45», Date 15:45:19Z        → passes
//   3  es idle           PRERENDER «a las 17:38»               → fails
//   4  root-idle60-late  PRERENDER «ás 17:38» at 20:44Z (5 h)  → fails
//   5  x03-idle65        MISS «ás 22:43», Date 20:43:23Z       → passes
// The Date of lines 3-5 is the survey's `at`: the survey kept age 0 and the
// instant, not that header.

const FIXTURE = leerJsonl(
  readFileSync("src/medicion/fixtures/cache-portada-2026-10-10.jsonl", "utf8"),
);

const base: RespuestaPortada = {
  ronda: 1,
  ruta: "/",
  inicio: "2026-10-12T20:00:00.000Z",
  status: 200,
  xVercelCache: "MISS",
  age: "0",
  date: "Mon, 12 Oct 2026 20:00:30 GMT",
  frescura: "22:00",
};

describe("SPEC-030 CA-4 frescuraEnHtml", () => {
  it.each([
    ['<span data-testid="freshness-age">Actualizado ás 17:38</span>', "17:38"],
    [
      '<p><span data-testid="freshness-age">Actualizado a las 09:05</span></p>',
      "09:05",
    ],
    ['<span data-testid="freshness-age">agora</span>', null],
    ["<main>sin liña</main>", null],
  ])("%s → %s", (html, time) => {
    expect(frescuraEnHtml(html)).toBe(time);
  });
});

describe("SPEC-030 CA-4 juzgar and veredicto over the survey", () => {
  it("the 5-hour PRERENDER fails; the MISS of the minute of Date passes", () => {
    const judged = FIXTURE.map((r) => juzgar(r).ok);
    expect(judged).toEqual([false, true, false, false, true]);
    expect(juzgar(FIXTURE[3])).toEqual({
      ok: false,
      motivo: "PRERENDER (HTML del build)",
    });
  });

  it("the survey does not comply (today: every response after idleness fails)", () => {
    const v = veredicto(FIXTURE);
    expect(v.cumple).toBe(false);
    expect(v.total).toBe(5);
    expect(v.fallos.map((f) => f.respuesta.xVercelCache)).toEqual([
      "PRERENDER",
      "PRERENDER",
      "PRERENDER",
    ]);
  });

  it("only the responses that pass: complies", () => {
    expect(veredicto([FIXTURE[1], FIXTURE[4]]).cumple).toBe(true);
  });

  it("no responses: never complies", () => {
    expect(veredicto([]).cumple).toBe(false);
  });

  it.each([
    ["21:59", true],
    ["22:00", true],
    ["22:01", true],
    ["21:58", false],
    ["22:02", false],
  ])("freshness %s against Date 20:00:30Z (22:00 in Madrid) → %s", (f, ok) => {
    expect(juzgar({ ...base, frescura: f }).ok).toBe(ok);
  });

  it("across midnight in Madrid", () => {
    const r = { ...base, date: "Mon, 12 Oct 2026 22:00:10 GMT" };
    expect(juzgar({ ...r, frescura: "23:59" }).ok).toBe(true);
    expect(juzgar({ ...r, frescura: "00:00" }).ok).toBe(true);
  });

  it.each([
    [{ status: 503 }, "status 503"],
    [{ status: null }, "status null"],
    [{ frescura: null }, "sin línea de frescura"],
    [{ date: null }, "sin Date"],
  ])("%j fails: %s", (patch, motivo) => {
    expect(juzgar({ ...base, ...patch })).toEqual({ ok: false, motivo });
  });

  it("STALE and HIT are fine while fresh", () => {
    for (const xVercelCache of ["HIT", "STALE", null])
      expect(juzgar({ ...base, xVercelCache }).ok).toBe(true);
  });

  it("defaults of the tool: 5 rounds, 65 s of idleness", () => {
    expect([RONDAS, ESPERA_S]).toEqual([5, 65]);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MatchStatus, Qualifier } from "@/model";
import { es } from "./es";
import { gl } from "./gl";
import { LOCALES, t } from "./index";

type Tree = { [key: string]: string | Tree };

const flatten = (tree: Tree, prefix = ""): [string, string][] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string"
      ? [[`${prefix}${key}`, value] as [string, string]]
      : flatten(value, `${prefix}${key}.`),
  );

const params = (s: string): string[] =>
  [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

const glFlat = flatten(gl);
const esFlat = flatten(es);

describe("CA-8 dictionaries", () => {
  it("gl and es expose the same flattened key paths", () => {
    expect(esFlat.map(([k]) => k)).toEqual(glFlat.map(([k]) => k));
  });

  it("no value is empty in either locale", () => {
    for (const [key, value] of [...glFlat, ...esFlat]) {
      expect(value.trim(), `empty value for "${key}"`).not.toBe("");
    }
  });

  it("the {param} placeholders of each string match across locales", () => {
    const esByKey = new Map(esFlat);
    for (const [key, value] of glFlat) {
      expect(params(esByKey.get(key) ?? ""), key).toEqual(params(value));
    }
  });

  it("SPEC-021 CA-7: half-time is «Descanso» in both, never an abbreviation", () => {
    expect(gl.xornada.halfTime).toBe("Descanso");
    expect(es.xornada.halfTime).toBe("Descanso");
  });

  it("status and qualifier keys mirror the model enums", () => {
    expect(Object.keys(gl.status)).toEqual(MatchStatus.options);
    expect(Object.keys(gl.qualifier)).toEqual(Qualifier.options);
  });

  it("keeps the current texts of the waiting page", () => {
    expect(gl.common.title).toBe("marcador.gal");
    expect(gl.waiting.heading).toBe("Todo o fútbol galego nunha pantalla");
    expect(gl.waiting.body).toBe(
      "Estamos a preparar o marcador. Volve pronto.",
    );
    expect(gl.common.switchLocale).toBe("Castellano");
    expect(es.common.title).toBe("marcador.gal");
    expect(es.waiting.heading).toBe("Todo el fútbol gallego en una pantalla");
    expect(es.waiting.body).toBe(
      "Estamos preparando el marcador. Vuelve pronto.",
    );
    expect(es.common.switchLocale).toBe("Galego");
  });

  it("has the qualifier and freshness literals of the spec", () => {
    expect(gl.qualifier).toEqual({
      confirmado: "confirmado",
      provisional: "provisional",
      sen_sinal: "sen sinal",
    });
    expect(es.qualifier).toEqual({
      confirmado: "confirmado",
      provisional: "provisional",
      sen_sinal: "sin señal",
    });
    expect(gl.freshness.lastData).toBe("último dato hai {n} min");
    expect(es.freshness.lastData).toBe("último dato hace {n} min");
    expect(es.status).toEqual({
      scheduled: "Programado",
      live: "En juego",
      finished: "Finalizado",
      postponed: "Aplazado",
      suspended: "Suspendido",
    });
  });
});

describe("SPEC-019 CA-6 Xornada keys", () => {
  it("has the Xornada texts in both locales", () => {
    expect(t("gl", "xornada.liveCount", { n: 2 })).toBe("2 en xogo");
    expect(t("es", "xornada.liveCount", { n: 2 })).toBe("2 en juego");
    expect(t("gl", "xornada.title")).toBe("Xornada");
    expect(t("es", "xornada.title")).toBe("Jornada");
    expect(t("gl", "xornada.locale")).toBe("Lingua");
    expect(t("es", "xornada.locale")).toBe("Idioma");
  });

  it("SPEC-020 CA-6 says the xornada is not available, in both languages", () => {
    expect(t("gl", "xornada.unavailable")).toBe(
      "Os resultados non están dispoñibles agora mesmo.",
    );
    expect(t("es", "xornada.unavailable")).toBe(
      "Los resultados no están disponibles en este momento.",
    );
    expect(gl.locales).toEqual({ gl: "gl", es: "es" });
    expect(es.locales).toEqual(gl.locales);
  });

  it("SPEC-027 CA-6 names the arrows of the strip in both languages", () => {
    expect(t("gl", "xornada.previous")).toBe("Xornada anterior");
    expect(t("gl", "xornada.next")).toBe("Xornada seguinte");
    expect(t("es", "xornada.previous")).toBe("Jornada anterior");
    expect(t("es", "xornada.next")).toBe("Jornada siguiente");
  });
});

describe("CA-9 domain literals", () => {
  it("gl.status equals the five literals of dominio.md, in order", () => {
    const md = readFileSync("docs/fundacion/dominio.md", "utf8");
    const row = md
      .split("\n")
      .find((line) => line.includes("**Estado de partido**"));
    expect(row).toBeDefined();
    const literals = [...(row ?? "").matchAll(/`\w+` \(([^)]+)\)/g)].map(
      (m) => m[1],
    );
    expect(literals).toHaveLength(5);
    expect(Object.values(gl.status)).toEqual(literals);
  });
});

describe("CA-10 typed t()", () => {
  it("LOCALES", () => {
    expect(LOCALES).toEqual(["gl", "es"]);
  });

  it("resolves dotted keys", () => {
    expect(t("gl", "status.live")).toBe("En xogo");
    expect(t("es", "status.live")).toBe("En juego");
    expect(t("gl", "waiting.heading")).toBe(gl.waiting.heading);
  });

  it("substitutes {n}", () => {
    expect(t("es", "freshness.lastData", { n: 3 })).toBe(
      "último dato hace 3 min",
    );
    expect(t("gl", "freshness.lastData", { n: "12" })).toBe(
      "último dato hai 12 min",
    );
  });

  it("rejects unknown keys and missing params at compile time", () => {
    // @ts-expect-error unknown key
    expect(() => t("gl", "status.halftime")).toBeDefined();
    // @ts-expect-error freshness.lastData requires { n }
    expect(() => t("gl", "freshness.lastData")).toBeDefined();
  });
});

describe("SPEC-023 Xornada controls", () => {
  it("CA-1/CA-2 weekdays and the day label: «ven 29» / «vie 29»", () => {
    expect(gl.weekday).toEqual({
      mon: "lun",
      tue: "mar",
      wed: "mér",
      thu: "xov",
      fri: "ven",
      sat: "sáb",
      sun: "dom",
    });
    expect(es.weekday).toEqual({
      mon: "lun",
      tue: "mar",
      wed: "mié",
      thu: "jue",
      fri: "vie",
      sat: "sáb",
      sun: "dom",
    });
    expect(
      t("gl", "xornada.dayLabel", { weekday: gl.weekday.fri, day: 29 }),
    ).toBe("ven 29");
    expect(
      t("es", "xornada.dayLabel", { weekday: es.weekday.fri, day: 29 }),
    ).toBe("vie 29");
  });

  it("CA-3 filters: Todos · En xogo · Rematados / Todos · En juego · Finalizados, never «Directo»", () => {
    expect(gl.filter).toMatchObject({
      all: "Todos",
      live: "En xogo",
      finished: "Rematados",
    });
    expect(es.filter).toMatchObject({
      all: "Todos",
      live: "En juego",
      finished: "Finalizados",
    });
    expect(JSON.stringify([gl, es])).not.toMatch(/Directo/i);
  });

  it("CA-3 empty: «nada aquí» in both", () => {
    expect(t("gl", "xornada.empty")).toBe("nada aquí");
    expect(t("es", "xornada.empty")).toBe("nada aquí");
  });

  it("CA-5/CA-7 round and sidebar: «xornada N», «Competicións»", () => {
    expect(t("gl", "xornada.round", { n: 8 })).toBe("xornada 8");
    expect(t("es", "xornada.round", { n: 8 })).toBe("jornada 8");
    expect(t("gl", "xornada.competitions")).toBe("Competicións");
    expect(t("es", "xornada.competitions")).toBe("Competiciones");
    expect(t("gl", "xornada.matchCount", { n: 4 })).toBe("4 partidos");
    expect(t("es", "xornada.matchCount", { n: 4 })).toBe("4 partidos");
    expect(t("gl", "xornada.matchCountOne", { n: 1 })).toBe("1 partido");
    expect(t("es", "xornada.matchCountOne", { n: 1 })).toBe("1 partido");
  });

  it("B-2 months, abbreviated, and the day label with its month", () => {
    expect(Object.values(gl.month)).toEqual([
      "xan",
      "feb",
      "mar",
      "abr",
      "maio",
      "xuñ",
      "xul",
      "ago",
      "set",
      "out",
      "nov",
      "dec",
    ]);
    expect(Object.values(es.month)).toEqual([
      "ene",
      "feb",
      "mar",
      "abr",
      "may",
      "jun",
      "jul",
      "ago",
      "sep",
      "oct",
      "nov",
      "dic",
    ]);
    expect(
      t("gl", "xornada.dayMonthLabel", {
        weekday: gl.weekday.sat,
        day: 12,
        month: gl.month.sep,
      }),
    ).toBe("sáb 12 set");
    expect(
      t("es", "xornada.dayMonthLabel", {
        weekday: es.weekday.sat,
        day: 12,
        month: es.month.sep,
      }),
    ).toBe("sáb 12 sep");
  });
});

describe("SPEC-024 CA-8 freshness of the screen", () => {
  it("the line and the notice, in both languages", () => {
    expect(t("gl", "freshness.servedAt", { time: "18:05" })).toBe(
      "Actualizado ás 18:05",
    );
    expect(t("es", "freshness.servedAt", { time: "18:05" })).toBe(
      "Actualizado a las 18:05",
    );
    expect(gl.freshness.now).toBe("Actualizado agora");
    expect(es.freshness.now).toBe("Actualizado ahora");
    expect(t("gl", "freshness.ago", { n: 3 })).toBe("Actualizado hai 3 min");
    expect(t("es", "freshness.ago", { n: 3 })).toBe("Actualizado hace 3 min");
    expect(gl.freshness.polling).toBe("Sen tempo real: actualízase cada 30 s");
    expect(es.freshness.polling).toBe(
      "Sin tiempo real: se actualiza cada 30 s",
    );
    expect(gl.freshness.offline).toBe("Sen conexión");
    expect(es.freshness.offline).toBe("Sin conexión");
  });
});

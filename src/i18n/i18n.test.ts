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

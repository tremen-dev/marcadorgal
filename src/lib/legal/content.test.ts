import { describe, expect, it } from "vitest";
import {
  LEGAL_DOCS_ES,
  LEGAL_DOCS_GL,
  LEGAL_ROUTES,
  MARCA,
  TITULAR,
} from "./content";

describe("legal content", () => {
  it("defines titular and marca with real values", () => {
    expect(TITULAR.nombre).toBe("Alberto Fojo Eiras");
    expect(TITULAR.contacto).toBe("ola@tremen.dev");
    expect(MARCA.url).toBe("https://tremen.dev");
  });

  it("has matching routes for gl and es", () => {
    expect(LEGAL_ROUTES.gl.avisoLegal).toBe("/aviso-legal");
    expect(LEGAL_ROUTES.es.avisoLegal).toBe("/es/aviso-legal");
    expect(LEGAL_ROUTES.gl.privacidade).toBe("/privacidade");
    expect(LEGAL_ROUTES.es.privacidade).toBe("/es/privacidad");
    expect(LEGAL_ROUTES.gl.cookies).toBe("/cookies");
    expect(LEGAL_ROUTES.es.cookies).toBe("/es/cookies");
  });

  it("contains all three legal documents in gl and es", () => {
    const keys = ["avisoLegal", "privacidade", "cookies"] as const;
    for (const key of keys) {
      expect(LEGAL_DOCS_GL[key].title).toBeTruthy();
      expect(LEGAL_DOCS_GL[key].sections.length).toBeGreaterThan(0);
      expect(LEGAL_DOCS_ES[key].title).toBeTruthy();
      expect(LEGAL_DOCS_ES[key].sections.length).toBeGreaterThan(0);
    }
  });

  it("explicitly states absence of tracking cookies in cookies policy", () => {
    const glText = JSON.stringify(LEGAL_DOCS_GL.cookies);
    const esText = JSON.stringify(LEGAL_DOCS_ES.cookies);
    expect(glText).toContain("localStorage");
    expect(esText).toContain("localStorage");
  });
});

describe("audience measurement (SPEC-077 CA-6)", () => {
  const section = (doc: (typeof LEGAL_DOCS_GL)["privacidade"]) =>
    doc.sections.find((s) => s.title.includes("Medición de audiencia"));

  it("privacy has the section in gl and es with the same paragraphs", () => {
    const gl = section(LEGAL_DOCS_GL.privacidade);
    const es = section(LEGAL_DOCS_ES.privacidade);
    expect(gl).toBeDefined();
    expect(es).toBeDefined();
    expect(gl?.content.length).toBe(es?.content.length);
    expect(gl?.content.length).toBeGreaterThanOrEqual(3);
  });

  it.each([
    ["gl", LEGAL_DOCS_GL],
    ["es", LEGAL_DOCS_ES],
  ] as const)(
    "%s says what, who, without cookie, IP or lasting id, and that robots do not count",
    (_, docs) => {
      const text = JSON.stringify(section(docs.privacidade));
      for (const needle of [
        "Vercel",
        "ruta",
        "país",
        "cookie",
        "IP",
        "24 horas",
        "automatizados",
      ])
        expect(text, needle).toContain(needle);
      expect(text).toMatch(/dispositivo/);
      expect(text).toMatch(/orixe|origen/);
      expect(text).toMatch(
        /encargad[oa] do tratamento|encargado del tratamiento/,
      );
    },
  );

  it("privacy and cookies carry a new lastUpdated", () => {
    expect(LEGAL_DOCS_GL.privacidade.lastUpdated).toBe(
      "10 de novembro de 2026",
    );
    expect(LEGAL_DOCS_ES.privacidade.lastUpdated).toBe(
      "10 de noviembre de 2026",
    );
    expect(LEGAL_DOCS_GL.cookies.lastUpdated).toBe("10 de novembro de 2026");
    expect(LEGAL_DOCS_ES.cookies.lastUpdated).toBe("10 de noviembre de 2026");
  });

  it("cookies no longer promises no third-party analytics and names the measurement", () => {
    const gl = JSON.stringify(LEGAL_DOCS_GL.cookies);
    const es = JSON.stringify(LEGAL_DOCS_ES.cookies);
    expect(gl).not.toMatch(/analítica[^"]*de terceiros/);
    expect(es).not.toMatch(/analítica[^"]*de terceros/);
    expect(gl).toContain("Vercel Web Analytics");
    expect(es).toContain("Vercel Web Analytics");
  });
});

// SPEC-084 CA-4: the provisional results, explained in the aviso legal
// (the screen no longer marks them by default, CA-1).
describe("provisional results in the aviso legal (SPEC-084 CA-4)", () => {
  const paragraph = (doc: (typeof LEGAL_DOCS_GL)["avisoLegal"]) =>
    doc.sections.flatMap((s) => s.content).find((p) => /provisiona/.test(p));

  it.each([
    ["gl", LEGAL_DOCS_GL, /dunha soa fonte/, /sen confirmar/, /corríxese/],
    ["es", LEGAL_DOCS_ES, /de una sola fuente/, /sin confirmar/, /se corrige/],
  ] as const)(
    "%s: some results are provisional, from one source, unconfirmed, corrected if the source changes",
    (_, docs, one, unconfirmed, corrected) => {
      const text = paragraph(docs.avisoLegal);
      expect(text).toBeDefined();
      expect(text).toMatch(/[Aa]lg[uú]n/);
      expect(text).toMatch(one);
      expect(text).toMatch(unconfirmed);
      expect(text).toMatch(corrected);
      expect(text).toMatch(/fonte os cambia|fuente los cambia/);
    },
  );

  it("the aviso legal carries a new lastUpdated in gl and es", () => {
    expect(LEGAL_DOCS_GL.avisoLegal.lastUpdated).toBe("11 de novembro de 2026");
    expect(LEGAL_DOCS_ES.avisoLegal.lastUpdated).toBe(
      "11 de noviembre de 2026",
    );
  });

  // Asked by the titular at the gate of SPEC-084: the erratum of section 4.
  it("section 4 in gl is in Galician, like its es twin", () => {
    const gl = JSON.stringify(LEGAL_DOCS_GL.avisoLegal);
    expect(gl).not.toContain("reconciled");
    expect(gl).not.toContain("multiffuente");
    expect(gl).toContain("reconciliación multifonte");
  });
});

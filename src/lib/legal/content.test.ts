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

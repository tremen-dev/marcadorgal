import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CAMPO_REQUEST_BODY,
  EMPTY_BODY_FILE,
  FIXTURES,
  fixtureBytes,
  fixtureText,
} from "./fixture-files.ts";

// SPEC-031 CA-1: the captures of EPIC-004/_qa/sondeo, uncut, as the text that
// TextDecoder("iso-8859-15") gives for the bytes the server sent.
const dir = new URL("./fixtures/", import.meta.url);
const sondeo = new URL(
  "../../../docs/epicas/EPIC-004-fuente-rfef/_qa/sondeo/",
  import.meta.url,
);
const readme = readFileSync(new URL("README.md", dir), "utf8");

describe("CA-1 fixtures reales", () => {
  it("lists every panel of the sondeo", () => {
    const panels = readdirSync(sondeo)
      .filter((f) => f.startsWith("paneles-"))
      .map((f) => f.replace(/\.html$/, ""))
      .sort();
    expect(
      FIXTURES.filter((f) => f.origin === "sondeo")
        .map((f) => f.name)
        .sort(),
    ).toEqual(panels);
  });

  it.each(
    FIXTURES.filter((f) => f.origin === "sondeo").map((f) => [f.name, f]),
  )("%s is the sondeo capture, uncut, decoded as ISO-8859-15", (name, f) => {
    const text = fixtureText(f.name);
    expect(text).toBe(readFileSync(new URL(`${name}.html`, sondeo), "utf8"));
    if (f.file.endsWith(".raw"))
      expect(text).toBe(
        new TextDecoder("iso-8859-15").decode(
          readFileSync(new URL(f.file, dir)),
        ),
      );
  });

  it.each(FIXTURES.map((f) => [f.file]))("the README documents %s", (file) => {
    expect(readme).toContain(`\`${file}\``);
  });

  it("the README has the table of marks per match and minute", () => {
    expect(readme).toMatch(/## Marcas por partido/);
    expect(readme).toMatch(/parpadea/);
    expect(readme).toMatch(/verPartidoEnJuego/);
    expect(readme).toMatch(/minuto/i);
  });

  it("the README marks every sondeo fixture as GET, possibly cached (E-1)", () => {
    expect(readme).toMatch(/GET, posible caché/);
  });
});

describe("CA-1 fixtures de la serie POST del 2026-10-11 (E-1)", () => {
  const campo = FIXTURES.filter((f) => f.origin === "campo");

  it("there are POST fixtures of the series, with their requestBody in the README", () => {
    expect(campo.length).toBeGreaterThanOrEqual(2);
    for (const f of campo) expect(f.method).toBe("POST");
    expect(readme).toContain(CAMPO_REQUEST_BODY);
  });

  it("two consecutive POST of the same query are different bytes (ADR-018 §4)", () => {
    const md5 = (file: string) =>
      createHash("md5").update(fixtureBytes(file)).digest("hex");
    const [a, b] = campo;
    expect(md5(a.file)).not.toBe(md5(b.file));
  });

  it("the empty body is a real 0-byte 200 of the series, documented", () => {
    expect(fixtureBytes(EMPTY_BODY_FILE)).toHaveLength(0);
    expect(readme).toContain(`\`${EMPTY_BODY_FILE}\``);
    expect(readme).toMatch(/Content-Length: 0/);
  });

  it("the README has the marks table of the POST series, with «Última actualización»", () => {
    expect(readme).toMatch(/## Marcas por partido \(serie POST/);
    expect(readme).toMatch(/Última actualización/);
  });
});

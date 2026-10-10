import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FIXTURES, fixtureText } from "./fixture-files.ts";

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
    expect(FIXTURES.map((f) => f.name).sort()).toEqual(panels);
  });

  it.each(FIXTURES.map((f) => [f.name, f]))(
    "%s is the sondeo capture, uncut, decoded as ISO-8859-15",
    (name, f) => {
      const text = fixtureText(f.name);
      expect(text).toBe(readFileSync(new URL(`${name}.html`, sondeo), "utf8"));
      if (f.file.endsWith(".raw"))
        expect(text).toBe(
          new TextDecoder("iso-8859-15").decode(
            readFileSync(new URL(f.file, dir)),
          ),
        );
    },
  );

  it.each(FIXTURES.map((f) => [f.file]))("the README documents %s", (file) => {
    expect(readme).toContain(`\`${file}\``);
  });

  it("the README has the table of marks per match and minute", () => {
    expect(readme).toMatch(/## Marcas por partido/);
    expect(readme).toMatch(/parpadea/);
    expect(readme).toMatch(/verPartidoEnJuego/);
    expect(readme).toMatch(/minuto/i);
  });
});

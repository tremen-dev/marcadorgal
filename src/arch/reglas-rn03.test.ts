import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// SPEC-014 CA-1 (was SPEC-012 CA-1). The letter of RN-03 in reglas.md is the
// block ADR-011 §1 quotes, word for word: not one word more, not one word less.
// ADR-010 §1 is not rewritten: it gains a dated line that points to ADR-011.

const read = (relative: string) =>
  readFileSync(new URL(`../../${relative}`, import.meta.url), "utf8");

const words = (text: string) => text.replace(/\s+/g, " ").trim();

const ADR_010 =
  "docs/adr/ADR-010-el-cierre-manda-sobre-la-monotonia-y-reconciliacion-tras-el-cierre-forzoso.md";
const ADR_011 =
  "docs/adr/ADR-011-rn-03-en-vivo-baja-la-misma-fuente-que-subio-el-gol-u-otra-de-mas-peso.md";

// The quoted block of an ADR: the lines starting with "> " right after
// "Letra nueva de RN-03".
function adrQuote(path: string): string {
  const adr = read(path);
  const from = adr.search(/Letra\s+nueva\s+de\s+RN-03/);
  const lines = adr.slice(from).split("\n");
  const first = lines.findIndex((l) => /^\s*>/.test(l));
  const quoted: string[] = [];
  for (const line of lines.slice(first)) {
    const match = /^\s*> ?(.*)$/.exec(line);
    if (match === null) break;
    quoted.push(match[1]);
  }
  return words(quoted.join(" "));
}

// The RN-03 bullet of reglas.md: from "- **RN-03" up to the next line that is
// not an indented continuation of the bullet.
function reglasBullet(): { text: string; notes: string[] } {
  const lines = read("docs/fundacion/reglas.md").split("\n");
  const start = lines.findIndex((l) => l.startsWith("- **RN-03"));
  const body = [lines[start].slice(2)];
  const notes: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith("  ")) break;
    if (/^\s+\*Enmendada/.test(line)) notes.push(line.trim());
    else body.push(line);
  }
  return { text: words(body.join(" ")), notes };
}

describe("SPEC-014 CA-1 RN-03 says what ADR-011 §1 fixes", () => {
  it("quotes a non-empty block in ADR-011", () => {
    expect(adrQuote(ADR_011)).toMatch(/^\*\*RN-03 — Monotonía\.\*\*/);
  });

  it("has the RN-03 of reglas.md identical to the quote of ADR-011", () => {
    expect(reglasBullet().text).toBe(adrQuote(ADR_011));
  });

  it("lets the source that raised the score lower it", () => {
    expect(reglasBullet().text).toContain(
      "solo lo baja la fuente que lo subió u otra con más peso",
    );
  });

  it("is amended, not derogated: the ADR-010 note and a new dated ADR-011 one below it", () => {
    const { notes } = reglasBullet();
    expect(notes).toEqual([
      "*Enmendada el 2026-09-29 por ADR-010 §1.*",
      expect.stringMatching(
        /^\*Enmendada el \d{4}-\d{2}-\d{2} por ADR-011\.\*$/,
      ),
    ]);
    expect(read("docs/fundacion/reglas.md")).not.toMatch(/RN-03[^\n]*derogad/i);
  });

  it("has the FOUNDATION no-negotiable say the source that raised it or a heavier one", () => {
    expect(words(read("FOUNDATION.md"))).toContain(
      "solo lo baja la fuente que lo subió u otra con más peso (RN-03, ADR-011)",
    );
  });

  it("does not rewrite ADR-010 §1: its quote stays and a dated line points to ADR-011", () => {
    expect(adrQuote(ADR_010)).toMatch(
      /^\*\*RN-03 — Monotonía\.\*\* .*una fuente con más peso que la que lo subió/,
    );
    const adr = words(read(ADR_010));
    const section1 = adr.slice(
      adr.indexOf("1. **RN-03 rige"),
      adr.indexOf("2. **RN-12"),
    );
    expect(section1).toMatch(
      /\*\d{4}-\d{2}-\d{2}, supersedido en parte por ADR-011:\*/,
    );
  });

  it("has RN-06 in the order of ADR-011 H-3, with a dated note", () => {
    const reglas = words(read("docs/fundacion/reglas.md"));
    expect(reglas).toContain(
      "Orden de decisión: operador > RN-03 > RN-05 > RN-02 > RN-12 > RN-01.",
    );
    expect(reglas).toMatch(
      /RN-12 > RN-01\. \*Enmendada el \d{4}-\d{2}-\d{2} por ADR-011 \(H-3\)\.\*/,
    );
  });

  it("has ADR-010 §3 carry one dated line for SPEC-014 CA-9", () => {
    const adr = words(read(ADR_010));
    const section3 = adr.slice(
      adr.indexOf("3. **El cierre forzoso no saca"),
      adr.indexOf("4. **`--contrastar`"),
    );
    expect(section3.match(/SPEC-014 CA-9/g)).toHaveLength(1);
    expect(section3).toContain(
      "«`finished` confirmado» es cualquier `finished` sin la marca `forced_finish`",
    );
  });
});

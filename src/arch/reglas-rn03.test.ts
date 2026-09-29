import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// SPEC-012 CA-1. The letter of RN-03 in reglas.md is the block ADR-010 §1
// quotes, word for word: not one word more, not one word less.

const read = (relative: string) =>
  readFileSync(new URL(`../../${relative}`, import.meta.url), "utf8");

const words = (text: string) => text.replace(/\s+/g, " ").trim();

// The quoted block of ADR-010 §1: the lines starting with "> " right after
// "Letra nueva de RN-03".
function adrQuote(): string {
  const adr = read(
    "docs/adr/ADR-010-el-cierre-manda-sobre-la-monotonia-y-reconciliacion-tras-el-cierre-forzoso.md",
  );
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

describe("CA-1 RN-03 says what ADR-010 §1 fixes", () => {
  it("quotes a non-empty block in ADR-010", () => {
    expect(adrQuote()).toMatch(/^\*\*RN-03 — Monotonía\.\*\*/);
  });

  it("has the RN-03 of reglas.md identical to the quote", () => {
    expect(reglasBullet().text).toBe(adrQuote());
  });

  it("is amended, not derogated: dated and citing ADR-010 beside it", () => {
    const { notes } = reglasBullet();
    expect(notes).toEqual(["*Enmendada el 2026-09-29 por ADR-010 §1.*"]);
    expect(read("docs/fundacion/reglas.md")).not.toMatch(/RN-03[^\n]*derogad/i);
  });

  it("leaves the order of RN-06 untouched", () => {
    expect(words(read("docs/fundacion/reglas.md"))).toContain(
      "Orden de decisión: operador > RN-03 > RN-05 > RN-02 > RN-01.",
    );
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// SPEC-016 CA-1. The postponed/suspended sentence of RN-02 in reglas.md is the
// block ADR-012 §1 quotes, word for word. The rest of RN-02 does not change,
// and a dated note cites ADR-012 below it.

const read = (relative: string) =>
  readFileSync(new URL(`../../${relative}`, import.meta.url), "utf8");

const words = (text: string) => text.replace(/\s+/g, " ").trim();

const ADR =
  "docs/adr/ADR-012-rn-02-postponed-y-suspended-los-da-la-fuente-ganadora-con-cualificador-y-reversibles.md";

// The quoted block of ADR-012 §1: the lines starting with "> " right after
// "Letra nueva de la frase".
function adrQuote(): string {
  const adr = read(ADR);
  const from = adr.search(/Letra\s+nueva\s+de\s+la\s+frase/);
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

// The RN-02 bullet of reglas.md: from "- **RN-02" up to the next line that is
// not an indented continuation. Dated notes apart.
function reglasBullet(): { text: string; notes: string[] } {
  const lines = read("docs/fundacion/reglas.md").split("\n");
  const start = lines.findIndex((l) => l.startsWith("- **RN-02 "));
  const body = [lines[start].slice(2)];
  const notes: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith("  ")) break;
    if (/^\s+\*(Añadida|Enmendada)/.test(line)) notes.push(line.trim());
    else body.push(line);
  }
  return { text: words(body.join(" ")), notes };
}

// What RN-02 says before and after the amended sentence: untouched.
const BEFORE =
  words(`**RN-02 — Transiciones.** \`scheduled → live\` cuando una fuente lo dice y
  el kickoff está a menos de 15 minutos. \`live → finished\` cuando lo dice la
  fuente ganadora, o a kickoff + 120 minutos si nadie lo cierra (con
  cualificador \`provisional\`).`);
const AFTER = "No hay más transiciones automáticas.";

describe("SPEC-016 CA-1 RN-02 says what ADR-012 §1 fixes", () => {
  it("quotes a non-empty block in ADR-012 §1", () => {
    expect(adrQuote()).toMatch(/^`postponed` y `suspended` los da la fuente/);
  });

  it("has the RN-02 of reglas.md with the quote in place of the old sentence", () => {
    expect(reglasBullet().text).toBe(`${BEFORE} ${adrQuote()} ${AFTER}`);
  });

  it("no longer reserves postponed and suspended to the federation", () => {
    expect(reglasBullet().text).not.toContain(
      "solo por fuente con prioridad de federación o por operador",
    );
  });

  it("is amended, not derogated: dated and citing ADR-012 below it", () => {
    expect(reglasBullet().notes).toEqual([
      expect.stringMatching(
        /^\*Enmendada el \d{4}-\d{2}-\d{2} por ADR-012\.\*$/,
      ),
    ]);
    expect(read("docs/fundacion/reglas.md")).not.toMatch(/RN-02[^\n]*derogad/i);
  });

  it("leaves the order of RN-06 untouched", () => {
    expect(words(read("docs/fundacion/reglas.md"))).toContain(
      "Orden de decisión: operador > RN-03 > RN-05 > RN-02 > RN-01.",
    );
  });
});

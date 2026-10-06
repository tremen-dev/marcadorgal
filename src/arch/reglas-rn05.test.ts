import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// SPEC-018 CA-1. The letter of RN-05 in reglas.md is the block ADR-013 §2
// quotes, word for word, behind its label (the quote does not carry the
// label). Ventana in dominio.md is the block of ADR-013 §1, and Cualificador
// lets sen_sinal live in scheduled with a kickoff in the past.

const read = (relative: string) =>
  readFileSync(new URL(`../../${relative}`, import.meta.url), "utf8");

const words = (text: string) => text.replace(/\s+/g, " ").trim();

const ADR_013 =
  "docs/adr/ADR-013-partido-sin-directo-de-la-fuente-prorroga-de-la-ventana-hasta-el-final-y-sen-sinal-en-scheduled.md";

// The quoted block of ADR-013 right after `marker`: the "> " lines.
function adrQuote(marker: RegExp): string {
  const adr = read(ADR_013);
  const from = adr.search(marker);
  if (from < 0) return "";
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

const LABEL = "**RN-05 — Silencio.**";

function reglasBullet(): { text: string; notes: string[] } {
  const lines = read("docs/fundacion/reglas.md").split("\n");
  const start = lines.findIndex((l) => l.startsWith("- **RN-05"));
  const body = [lines[start].slice(2)];
  const notes: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith("  ")) break;
    if (/^\s+\*Enmendada/.test(line)) notes.push(line.trim());
    else body.push(line);
  }
  return { text: words(body.join(" ")), notes };
}

// The row of a term in the table of dominio.md, cells trimmed.
function dominioRow(term: string): string[] {
  const line = read("docs/fundacion/dominio.md")
    .split("\n")
    .find((l) => l.startsWith(`| **${term}** |`));
  if (line === undefined) return [];
  return line
    .split("|")
    .slice(1, -1)
    .map((cell) => words(cell));
}

describe("SPEC-018 CA-1 RN-05, Ventana and Cualificador say what ADR-013 fixes", () => {
  it("quotes non-empty blocks in ADR-013 §1 and §2", () => {
    expect(adrQuote(/Letra\s+nueva\s+de\s+RN-05/)).toMatch(/^Un partido `live`/);
    expect(adrQuote(/Letra\s+nueva\s+de\s+\*\*Ventana\*\*/)).toMatch(
      /^De kickoff − 10 min/,
    );
  });

  it("has the RN-05 of reglas.md identical to the quote of ADR-013 §2, behind its label", () => {
    expect(reglasBullet().text).toBe(
      `${LABEL} ${adrQuote(/Letra\s+nueva\s+de\s+RN-05/)}`,
    );
  });

  it("opens an Alert in live and not in scheduled", () => {
    expect(reglasBullet().text).toContain(
      "En `live` abre una Alert; en `scheduled`, no.",
    );
  });

  it("is amended with a dated ADR-013 note", () => {
    expect(reglasBullet().notes).toEqual([
      expect.stringMatching(
        /^\*Enmendada el \d{4}-\d{2}-\d{2} por ADR-013\.\*$/,
      ),
    ]);
  });

  it("has Ventana in dominio.md say the quote of ADR-013 §1", () => {
    const [, definition] = dominioRow("Ventana");
    expect(definition).toContain(
      adrQuote(/Letra\s+nueva\s+de\s+\*\*Ventana\*\*/),
    );
  });

  it("has Cualificador allow sen_sinal in live or in scheduled with a past kickoff", () => {
    const [, definition] = dominioRow("Cualificador");
    expect(definition).toContain(
      "`sen_sinal` (sin datos en 15 min: en `live`, o en `scheduled` con kickoff pasado)",
    );
  });

  it("keeps RN-06's order of decision untouched", () => {
    expect(words(read("docs/fundacion/reglas.md"))).toContain(
      "Orden de decisión: operador > RN-03 > RN-05 > RN-02 > RN-12 > RN-01.",
    );
  });
});

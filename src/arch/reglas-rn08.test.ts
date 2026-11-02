import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// SPEC-044 CA-1 (ADR-025 §7). The letter of RN-08 in reglas.md does not
// change: it gains a dated note that cites ADR-025. Ventana in dominio.md
// keeps the block of ADR-013 §1 and adds the sentence of ADR-025 §7, word
// for word. Line endings are normalised so the test reads the same text
// whatever the checkout (core.autocrlf).

const read = (relative: string) =>
  readFileSync(new URL(`../../${relative}`, import.meta.url), "utf8").replace(
    /\r\n/g,
    "\n",
  );

const words = (text: string) => text.replace(/\s+/g, " ").trim();

const ADR_025 =
  "docs/adr/ADR-025-horizonte-de-recuperacion-por-fuente-y-motor-a-la-hora-de-la-observacion-fuera-de-la-ventana-comun.md";

// The «…» quotes of ADR-025 §7, in order: Ventana first, then the RN-08 note.
function adrQuotes(): string[] {
  const adr = read(ADR_025);
  const from = adr.search(/Letras\s+nuevas/);
  if (from < 0) return [];
  const section = adr.slice(from).split("\n")[0];
  return [...section.matchAll(/«([^»]+)»/g)].map((m) => words(m[1]));
}

// The letter of RN-08 as it reads today: SPEC-013 CA-1 froze it, and this
// spec keeps it (ADR-025 §7: "Su letra no cambia").
const RN08_TODAY =
  words(`**RN-08 — Cortesía y cadencia.** Ninguna fuente \`pull\` se consulta más a
  menudo que la cadencia declarada en su registro, ni fuera de ventana. Toda
  petición lleva el user-agent identificado del proyecto. La cadencia es un
  dato del registro, no una constante del adaptador.`);

// A bullet of reglas.md: from "- **RN-xx" up to the next line that is not an
// indented continuation. Dated notes (*Añadida…*, *Enmendada…*, *Precisada…*)
// apart.
function bullet(id: string): { text: string; notes: string[] } {
  const lines = read("docs/fundacion/reglas.md").split("\n");
  const start = lines.findIndex((l) => l.startsWith(`- **${id} `));
  if (start === -1) return { text: "", notes: [] };
  const body = [lines[start].slice(2)];
  const notes: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith("  ")) break;
    if (/^\s+\*(Añadida|Enmendada|Precisada)/.test(line))
      notes.push(line.trim());
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

const ADR_013_VENTANA = words(`De kickoff − 10 min a kickoff + 150 min, o hasta
  \`finished\`. Si a kickoff + 150 sigue \`scheduled\`, se prorroga hasta
  kickoff + 6 h, con sondeo cada 5 min.`);

describe("SPEC-044 CA-1 RN-08 and Ventana say what ADR-025 §7 fixes", () => {
  it("quotes two non-empty blocks in ADR-025 §7: Ventana and the RN-08 note", () => {
    const [ventana, nota] = adrQuotes();
    expect(ventana).toMatch(/^\[…\] con sondeo cada 5 min\./);
    expect(nota).toMatch(/^\*Precisada el <fecha> por ADR-025:/);
  });

  it("keeps the letter of RN-08 exactly as it was", () => {
    expect(bullet("RN-08").text).toBe(RN08_TODAY);
  });

  it("gives RN-08 the dated note of ADR-025 §7, and only that one", () => {
    const [, nota] = adrQuotes();
    const expected = nota.replace("<fecha>", "2026-11-02");
    expect(bullet("RN-08").notes).toEqual([expected]);
    expect(expected).toMatch(/^\*Precisada el \d{4}-\d{2}-\d{2} por ADR-025:/);
  });

  it("has Ventana in dominio.md say ADR-013 §1 followed by the sentence of ADR-025 §7", () => {
    const [ventana] = adrQuotes();
    const added = ventana.replace(/^\[…\] con sondeo cada 5 min\.\s*/, "");
    const [, definition] = dominioRow("Ventana");
    expect(definition).toContain(ADR_013_VENTANA);
    expect(definition).toContain(added);
    expect(definition.indexOf(added)).toBeGreaterThan(
      definition.indexOf(ADR_013_VENTANA),
    );
  });

  it("names ADR-025 in the notes column of Ventana", () => {
    const [, , notes] = dominioRow("Ventana");
    expect(notes).toContain("ADR-025");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DecisionRule } from "../model/index.ts";

// SPEC-013 CA-1. reglas.md gains RN-12 word for word from ADR-010 §2, inside
// the section of the rules that may appear in Decision.rule, and RN-08 is not
// touched: the declared window stays the same (ADR-010 §3).

const read = (relative: string) =>
  readFileSync(new URL(`../../${relative}`, import.meta.url), "utf8");

const words = (text: string) => text.replace(/\s+/g, " ").trim();

const ADR =
  "docs/adr/ADR-010-el-cierre-manda-sobre-la-monotonia-y-reconciliacion-tras-el-cierre-forzoso.md";

// The quoted block of ADR-010 §2: the lines starting with "> " right after
// the first "> **RN-12" of the ADR.
function adrQuote(): string {
  const lines = read(ADR).split("\n");
  const first = lines.findIndex((l) => /^\s*> \*\*RN-12/.test(l));
  const quoted: string[] = [];
  for (const line of lines.slice(first)) {
    const match = /^\s*> ?(.*)$/.exec(line);
    if (match === null) break;
    quoted.push(match[1]);
  }
  return words(quoted.join(" "));
}

// A bullet of reglas.md: from "- **RN-xx" up to the next line that is not an
// indented continuation. Dated notes (*Añadida…*, *Enmendada…*) apart.
function bullet(id: string): { text: string; notes: string[] } | null {
  const lines = read("docs/fundacion/reglas.md").split("\n");
  const start = lines.findIndex((l) => l.startsWith(`- **${id} `));
  if (start === -1) return null;
  const body = [lines[start].slice(2)];
  const notes: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith("  ")) break;
    if (/^\s+\*(Añadida|Enmendada)/.test(line)) notes.push(line.trim());
    else body.push(line);
  }
  return { text: words(body.join(" ")), notes };
}

// The rule ids of the section «las únicas que pueden aparecer en
// Decision.rule»: from its heading to the next heading.
function motorSection(): string[] {
  const text = read("docs/fundacion/reglas.md");
  const from = text.indexOf("## Motor de decisiones");
  const to = text.indexOf("\n## ", from + 1);
  return [...text.slice(from, to).matchAll(/^- \*\*(RN-\d+) /gm)].map(
    (m) => m[1],
  );
}

describe("SPEC-013 CA-1 RN-12 in reglas.md", () => {
  it("quotes a non-empty RN-12 block in ADR-010 §2", () => {
    expect(adrQuote()).toMatch(
      /^\*\*RN-12 — Reconciliación tras cierre forzoso\.\*\*/,
    );
  });

  it("has the RN-12 of reglas.md identical to the quote", () => {
    expect(bullet("RN-12")?.text).toBe(adrQuote());
  });

  it("puts RN-12 among the rules that may appear in Decision.rule", () => {
    expect(motorSection()).toContain("RN-12");
  });

  it("lists every rule of the motor section that DecisionRule carries", () => {
    const deciding = DecisionRule.options.filter((r) => r !== "operator");
    const motor = motorSection();
    for (const rule of deciding) expect(motor).toContain(rule);
  });

  it("leaves RN-08 exactly as it was", () => {
    expect(bullet("RN-08")).toEqual({
      text: words(`**RN-08 — Cortesía y cadencia.** Ninguna fuente \`pull\` se consulta más a
  menudo que la cadencia declarada en su registro, ni fuera de ventana. Toda
  petición lleva el user-agent identificado del proyecto. La cadencia es un
  dato del registro, no una constante del adaptador.`),
      notes: [],
    });
  });
});

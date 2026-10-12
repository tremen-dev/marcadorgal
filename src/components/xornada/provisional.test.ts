import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { es } from "@/i18n/es";
import { gl } from "@/i18n/gl";
import { type MatchStatus, PublicMatch, type Qualifier } from "@/model";
import { PROVISIONAL_DISPLAYS } from "@/xornada/qualifier";
import { buildXornada, xornadaDays } from "@/xornada/view";
import { MatchRow } from "./MatchRow";
import { XornadaBody } from "./XornadaBody";

// SPEC-034 CA-2..CA-4, CA-6: the row and the legend in the three modes, gl
// and es, rendered as the server sends them.

const LOCALES = [
  ["gl", gl],
  ["es", es],
] as const;

function match(
  id: string,
  status: MatchStatus,
  qualifier: Qualifier,
): PublicMatch {
  const scored =
    status === "live" || status === "finished" || status === "suspended";
  return PublicMatch.parse({
    matchId: id,
    competitionId: "primera-division",
    competitionName: "Primeira División",
    tier: 1,
    round: 8,
    kickoff: "2026-10-03T16:00:00Z",
    home: { name: "RC Celta", shortName: "Celta" },
    away: { name: "Real Madrid", shortName: null },
    status,
    score: scored ? { home: 1, away: 0 } : null,
    minute: status === "live" ? 30 : null,
    ...(status === "live" ? { addedMinute: null, halfTime: false } : {}),
    qualifier,
    version: 3,
    observedAt: "2026-10-03T16:30:00Z",
    decidedAt: "2026-10-03T16:30:02Z",
  });
}

const PATHS = { gl: "/demo/xornada", es: "/es/demo/xornada" } as const;

function rowHtml(
  locale: "gl" | "es",
  mode: (typeof PROVISIONAL_DISPLAYS)[number],
  status: MatchStatus,
  qualifier: Qualifier,
): string {
  const [competition] = buildXornada(
    [match("m-1", status, qualifier)],
    undefined,
    mode,
  );
  return renderToStaticMarkup(
    createElement("ul", null, [
      createElement(MatchRow, {
        key: "r",
        row: competition.rows[0],
        locale,
      }),
    ]),
  );
}

function bodyHtml(
  locale: "gl" | "es",
  mode: (typeof PROVISIONAL_DISPLAYS)[number],
  matches: PublicMatch[],
): string {
  return renderToStaticMarkup(
    createElement(XornadaBody, {
      locale,
      competitions: buildXornada(matches, undefined, mode),
      days: xornadaDays(matches, "2026-10-03T16:50:00Z"),
      paths: PATHS,
      provisionalDisplay: mode,
    }),
  );
}

const text = (html: string): string => html.replace(/<[^>]*>/g, "");
const legendOf = (html: string): string | null =>
  /<p[^>]*data-provisional-legend[^>]*>/.exec(html)?.[0] ?? null;

describe("SPEC-034 i18n of the legend", () => {
  it("has the literals of CA-3", () => {
    expect(gl.qualifier.provisionalLegend).toBe(
      "* provisional: dato dunha soa fonte, aínda sen confirmar",
    );
    expect(es.qualifier.provisionalLegend).toBe(
      "* provisional: dato de una sola fuente, aún sin confirmar",
    );
  });
});

for (const [locale, dict] of LOCALES) {
  describe(`SPEC-034 MatchRow (${locale})`, () => {
    it("CA-2 label: the word, amber, next to the margin", () => {
      const html = rowHtml(locale, "label", "live", "provisional");
      expect(html).toMatch(
        new RegExp(
          `<span class="[^"]*qualifier[^"]*amber[^"]*" data-testid="match-qualifier">${dict.qualifier.provisional}</span>`,
        ),
      );
      expect(html).not.toContain("*");
    });

    it("CA-3 mark: the glyph * amber and aria-hidden, the word for screen readers", () => {
      for (const status of ["live", "finished"] as const) {
        const html = rowHtml(locale, "mark", status, "provisional");
        expect(html).toMatch(
          /<span class="[^"]*amber[^"]*" aria-hidden="true" data-testid="provisional-mark">\*<\/span>/,
        );
        expect(html).toMatch(
          new RegExp(
            `<span class="[^"]*srOnly[^"]*">${dict.qualifier.provisional}</span>`,
          ),
        );
        // The label of `label` is not there: the word is only for readers.
        expect(html).not.toMatch(
          new RegExp(`amber[^"]*"[^>]*>${dict.qualifier.provisional}<`),
        );
      }
    });

    it("CA-4 hidden: nothing seen nor read; data-qualifier stays", () => {
      const html = rowHtml(locale, "hidden", "live", "provisional");
      expect(html).toContain('data-qualifier="provisional"');
      expect(text(html)).not.toContain(dict.qualifier.provisional);
      expect(html).not.toContain("*");
      expect(html).not.toContain("match-qualifier");
    });

    it("CA-1 sen sinal keeps its label and confirmado has none, in every mode", () => {
      for (const mode of PROVISIONAL_DISPLAYS) {
        expect(rowHtml(locale, mode, "live", "sen_sinal")).toContain(
          `data-testid="match-qualifier">${dict.qualifier.sen_sinal}</span>`,
        );
        const confirmed = rowHtml(locale, mode, "live", "confirmado");
        expect(confirmed).not.toContain("match-qualifier");
        expect(confirmed).not.toContain("provisional-mark");
      }
    });
  });

  describe(`SPEC-034 the legend (${locale})`, () => {
    const withProvisional = [
      match("m-1", "live", "provisional"),
      match("m-2", "finished", "confirmado"),
    ];
    const without = [
      match("m-1", "live", "sen_sinal"),
      match("m-2", "finished", "confirmado"),
    ];

    it("CA-3 mark: one legend at the foot of the list, shown when a served row is provisional", () => {
      const html = bodyHtml(locale, "mark", withProvisional);
      expect(html.match(/data-provisional-legend/g)).toHaveLength(1);
      const legend = legendOf(html);
      expect(legend).not.toBeNull();
      expect(legend).not.toContain("hidden");
      expect(html).toContain(`>${dict.qualifier.provisionalLegend}</p>`);
      // At the foot: after the last row.
      expect(html.indexOf("data-provisional-legend")).toBeGreaterThan(
        html.lastIndexOf('data-testid="match-row"'),
      );
    });

    it("CA-3 mark: served hidden when no row is provisional", () => {
      const legend = legendOf(bodyHtml(locale, "mark", without));
      expect(legend).toContain("hidden");
    });

    it.each(["label", "hidden"] as const)("CA-2/CA-4 %s: no legend", (mode) => {
      const html = bodyHtml(locale, mode, withProvisional);
      expect(html).not.toContain("data-provisional-legend");
      expect(text(html)).not.toContain(dict.qualifier.provisionalLegend);
    });
  });
}

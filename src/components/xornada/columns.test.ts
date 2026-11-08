import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { es } from "@/i18n/es";
import { gl } from "@/i18n/gl";
import { type MatchStatus, PublicMatch } from "@/model";
import { buildXornada, xornadaDays } from "@/xornada/view";
import { XornadaBody } from "./XornadaBody";

// SPEC-040 CA-4 (H-2, H-5): no sidebar; the competitions in one grid of
// columns, each header with the count the sidebar used to carry.

function match(
  id: string,
  tier: number,
  competitionId: string,
  status: MatchStatus,
): PublicMatch {
  const scored = status === "live" || status === "finished";
  return PublicMatch.parse({
    matchId: id,
    competitionId,
    competitionName: competitionId,
    tier,
    round: 8,
    kickoff: "2026-10-03T16:00:00Z",
    home: { name: "RC Celta", shortName: "Celta" },
    away: { name: "Real Madrid", shortName: null },
    status,
    score: scored ? { home: 1, away: 0 } : null,
    minute: status === "live" ? 30 : null,
    ...(status === "live" ? { addedMinute: null, halfTime: false } : {}),
    qualifier: "confirmado",
    version: 3,
    observedAt: "2026-10-03T16:30:00Z",
    decidedAt: "2026-10-03T16:30:02Z",
    homeScoredAt: null,
    awayScoredAt: null,
  });
}

const MATCHES = [
  match("a1", 1, "primera-division", "live"),
  match("a2", 1, "primera-division", "live"),
  match("a3", 1, "primera-division", "finished"),
  match("b1", 2, "segunda-division", "scheduled"),
  match("b2", 2, "segunda-division", "finished"),
  match("b3", 2, "segunda-division", "finished"),
];

const body = (locale: "gl" | "es"): string =>
  renderToStaticMarkup(
    createElement(XornadaBody, {
      locale,
      competitions: buildXornada(MATCHES),
      days: xornadaDays(MATCHES, "2026-10-03T16:50:00Z"),
      paths: { gl: "/demo/xornada", es: "/es/demo/xornada" },
      provisionalDisplay: "label",
    }),
  );

const element = (html: string, testid: string, competition: string) =>
  new RegExp(
    `<span[^>]*data-competition-count="${competition}"[^>]*data-testid="${testid}"[^>]*>(.*?)</span></span>`,
  ).exec(html);

for (const [locale, dict] of [
  ["gl", gl],
  ["es", es],
] as const) {
  describe(`SPEC-040 CA-4 the columns (${locale})`, () => {
    const html = body(locale);

    it("no sidebar: no nav, no entry, no «Competicións»", () => {
      // By default the day-strip is hidden: the filters and gl·es are the only navs; none of competitions.
      const navs = [...html.matchAll(/<nav[^>]*data-testid="([^"]+)"/g)].map(
        (m) => m[1],
      );
      expect(navs).toEqual(["locale-switch", "filters"]);
      expect(html.slice(html.indexOf("<main"))).not.toContain("<nav");
      expect(html).not.toContain("sidebar");
      expect(html).not.toContain("data-competition-link");
      expect(html).not.toContain(
        locale === "gl" ? "Competicións" : "Competiciones",
      );
    });

    it("renders day-strip when showDayStrip is true", () => {
      const withStrip = renderToStaticMarkup(
        createElement(XornadaBody, {
          locale,
          competitions: buildXornada(MATCHES),
          days: xornadaDays(MATCHES, "2026-10-03T16:50:00Z"),
          paths: { gl: "/demo/xornada", es: "/es/demo/xornada" },
          provisionalDisplay: "label",
          showDayStrip: true,
        }),
      );
      const navs = [
        ...withStrip.matchAll(/<nav[^>]*data-testid="([^"]+)"/g),
      ].map((m) => m[1]);
      expect(navs).toEqual(["locale-switch", "day-strip", "filters"]);
    });

    it("the sections, in tier order, inside one grid of columns", () => {
      const grid =
        /<div class="[^"]*columns[^"]*" data-testid="xornada-columns">/.exec(
          html,
        );
      expect(grid).not.toBeNull();
      const inside = html.slice(grid?.index ?? 0);
      const ids = [...inside.matchAll(/<section id="(xornada-[^"]+)"/g)].map(
        (m) => m[1],
      );
      expect(ids).toEqual([
        "xornada-primera-division",
        "xornada-segunda-division",
      ]);
    });

    it("with live matches the header says «N en xogo» in words", () => {
      const live = element(html, "live-pill", "primera-division");
      expect(live?.[0]).toContain(dict.xornada.liveCount.replace("{n}", "2"));
      // The total is there, hidden, for the client to show with a filter.
      const total = element(html, "competition-total", "primera-division");
      expect(total?.[0]).toContain("hidden");
    });

    it("without live matches the header says the total, «N partidos»", () => {
      expect(element(html, "live-pill", "segunda-division")).toBeNull();
      const total = element(html, "competition-total", "segunda-division");
      expect(total?.[0]).not.toContain("hidden");
      expect(total?.[0]).toContain(dict.xornada.matchCount.replace("{n}", "3"));
    });
  });
}

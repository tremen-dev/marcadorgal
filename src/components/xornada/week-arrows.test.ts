import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Neighbours } from "@/board/weeks";
import { es } from "@/i18n/es";
import { gl } from "@/i18n/gl";
import { PublicMatch } from "@/model";
import { buildXornada, xornadaDays } from "@/xornada/view";
import { XornadaBody } from "./XornadaBody";

// SPEC-072 CA-1, CA-2: ‹ and › of SPEC-027 CA-6 no longer depend on the
// strip of days; without it, they flank the text of the <h1> (H-1 = A).

const MATCH = PublicMatch.parse({
  matchId: "m-1",
  competitionId: "primera-division",
  competitionName: "Primeira División",
  tier: 1,
  round: 8,
  kickoff: "2026-10-03T16:00:00Z",
  home: { name: "RC Celta", shortName: "Celta" },
  away: { name: "Real Madrid", shortName: null },
  status: "scheduled",
  score: null,
  minute: null,
  qualifier: "confirmado",
  version: 1,
  observedAt: "2026-10-03T10:00:00Z",
  decidedAt: "2026-10-03T10:00:02Z",
  homeScoredAt: null,
  awayScoredAt: null,
});

const PATHS = { gl: "/", es: "/es" } as const;
const BOTH: Neighbours = {
  previous: "/xornada/2026-09-26",
  next: "/xornada/2026-10-10",
};

function bodyHtml(opts: {
  locale?: "gl" | "es";
  showDayStrip: boolean;
  arrows?: Neighbours;
  rows?: boolean;
}): string {
  const matches = opts.rows === false ? [] : [MATCH];
  return renderToStaticMarkup(
    createElement(XornadaBody, {
      locale: opts.locale ?? "gl",
      competitions: buildXornada(matches, undefined, "label"),
      days: xornadaDays(matches, "2026-10-03T12:00:00Z"),
      paths: PATHS,
      provisionalDisplay: "label",
      showDayStrip: opts.showDayStrip,
      arrows: opts.arrows,
    }),
  );
}

const count = (html: string, needle: string): number =>
  html.split(needle).length - 1;
const h1Of = (html: string): string =>
  /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? "";

describe("SPEC-072 CA-1 arrows independent of the strip", () => {
  it("strip hidden (the default) and arrows: each arrow once, no strip", () => {
    const html = bodyHtml({ showDayStrip: false, arrows: BOTH });
    expect(count(html, 'data-testid="week-previous"')).toBe(1);
    expect(count(html, 'data-testid="week-next"')).toBe(1);
    expect(html).not.toContain("day-strip");
  });

  it("strip hidden and no neighbour: each gap once", () => {
    const html = bodyHtml({
      showDayStrip: false,
      arrows: { previous: null, next: null },
    });
    expect(count(html, 'data-testid="week-previous-gap"')).toBe(1);
    expect(count(html, 'data-testid="week-next-gap"')).toBe(1);
  });

  it("strip shown and arrows: each arrow once, not duplicated", () => {
    const html = bodyHtml({ showDayStrip: true, arrows: BOTH });
    expect(html).toContain("day-strip");
    expect(count(html, 'data-testid="week-previous"')).toBe(1);
    expect(count(html, 'data-testid="week-next"')).toBe(1);
  });

  for (const showDayStrip of [false, true])
    it(`no arrows (demos), strip ${showDayStrip ? "shown" : "hidden"}: no arrow nor gap`, () => {
      const html = bodyHtml({ showDayStrip });
      expect(html).not.toMatch(/data-testid="week-(previous|next)/);
      expect(html).not.toMatch(/[‹›]/);
    });

  it("the default of showDayStrip is the production one: arrows in the title row", () => {
    const html = renderToStaticMarkup(
      createElement(XornadaBody, {
        locale: "gl",
        competitions: buildXornada([MATCH], undefined, "label"),
        days: xornadaDays([MATCH], "2026-10-03T12:00:00Z"),
        paths: PATHS,
        provisionalDisplay: "label",
        arrows: BOTH,
      }),
    );
    expect(html).not.toContain("day-strip");
    expect(count(html, 'data-testid="week-previous"')).toBe(1);
  });
});

describe("SPEC-072 CA-2 the contract of the links", () => {
  for (const [locale, dict] of [
    ["gl", gl],
    ["es", es],
  ] as const) {
    it(`${locale}: <a href> without fragment, aria-label, glyph aria-hidden, siblings of the <h1> text`, () => {
      const html = bodyHtml({ locale, showDayStrip: false, arrows: BOTH });
      for (const dir of ["previous", "next"] as const) {
        const a = new RegExp(
          `<a [^>]*href="${BOTH[dir]}"[^>]*aria-label="${dict.xornada[dir]}"[^>]*data-testid="week-${dir}"[^>]*><span aria-hidden="true">${dir === "previous" ? "‹" : "›"}</span></a>`,
        );
        expect(html).toMatch(a);
      }
      expect(html).not.toMatch(/href="[^"]*#[^"]*"[^>]*data-testid="week-/);
      // Not part of the accessible name of the <h1>.
      const h1 = h1Of(html);
      expect(h1).not.toBe("");
      expect(h1).not.toMatch(/[‹›]|week-/);
      // ‹, the <h1>, › in that order.
      const prev = html.indexOf('data-testid="week-previous"');
      const title = html.indexOf('data-testid="xornada-title"');
      const next = html.indexOf('data-testid="week-next"');
      expect(prev).toBeGreaterThan(-1);
      expect(prev).toBeLessThan(title);
      expect(title).toBeLessThan(next);
    });
  }

  it("without a neighbour: a gap aria-hidden, not a link, not focusable", () => {
    const html = bodyHtml({
      showDayStrip: false,
      arrows: { previous: null, next: BOTH.next },
    });
    const gap = /<span[^>]*data-testid="week-previous-gap"[^>]*>/.exec(
      html,
    )?.[0];
    expect(gap).toBeDefined();
    expect(gap).toContain('aria-hidden="true"');
    expect(gap).not.toContain("tabindex");
    expect(html).not.toContain('data-testid="week-previous"');
    expect(count(html, 'data-testid="week-next"')).toBe(1);
  });
});

import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublicMatch } from "@/model";
import { buildXornada, xornadaDays } from "@/xornada/view";
import { XornadaBody } from "./XornadaBody";
import { XornadaScreen } from "./XornadaScreen";

const MATCH = PublicMatch.parse({
  matchId: "a1",
  competitionId: "primera-division",
  competitionName: "Primera División",
  tier: 1,
  round: 8,
  kickoff: "2026-10-03T16:00:00Z",
  home: { name: "RC Celta", shortName: "Celta" },
  away: { name: "Real Madrid", shortName: null },
  status: "live",
  score: { home: 1, away: 0 },
  minute: 30,
  addedMinute: null,
  halfTime: false,
  qualifier: "confirmado",
  version: 3,
  observedAt: "2026-10-03T16:30:00Z",
  decidedAt: "2026-10-03T16:30:02Z",
  homeScoredAt: null,
  awayScoredAt: null,
});

const props = (matches: PublicMatch[]) => ({
  locale: "gl" as const,
  competitions: buildXornada(matches),
  days: xornadaDays(matches, "2026-10-03T16:50:00Z"),
  paths: { gl: "/demo/xornada", es: "/es/demo/xornada" },
  provisionalDisplay: "label" as const,
});

const header = (html: string): string =>
  html.slice(html.indexOf("<header"), html.indexOf("</header>"));

describe("SPEC-082 CA-1 the header without gl·es", () => {
  it("has neither the selector nor hreflang links", () => {
    const html = header(
      renderToStaticMarkup(createElement(XornadaBody, props([MATCH]))),
    );
    expect(html).not.toContain('data-testid="locale-switch"');
    expect(html.toLowerCase()).not.toContain("hreflang");
  });
});

describe("SPEC-082 CA-3 the folded filters button", () => {
  const html = renderToStaticMarkup(createElement(XornadaBody, props([MATCH])));

  it("is a button in the bar, folded, controlling the filters", () => {
    const button = /<button[^>]*data-testid="filters-toggle"[^>]*>/.exec(
      header(html),
    )?.[0];
    expect(button).toBeDefined();
    expect(button).toContain('type="button"');
    expect(button).toContain('aria-expanded="false"');
    expect(button).toContain('aria-label="Filtros"');
    const controls = /aria-controls="([^"]+)"/.exec(button ?? "")?.[1];
    expect(html).toMatch(
      new RegExp(`<nav[^>]*id="${controls}"[^>]*data-testid="filters"`),
    );
  });

  it("draws an svg icon in currentColor, hidden from the tree", () => {
    const svg =
      /<button[^>]*data-testid="filters-toggle"[^>]*>(.*?)<\/button>/.exec(
        html,
      )?.[1];
    expect(svg).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(svg).toContain("currentColor");
    // n = 0 on the server: no badge.
    expect(svg).not.toContain('data-testid="filters-badge"');
  });

  it("is not served when there is no panel to open (no rows)", () => {
    const empty = renderToStaticMarkup(createElement(XornadaBody, props([])));
    expect(empty).not.toContain('data-testid="filters-toggle"');
  });
});

describe("SPEC-082 CA-6 without JavaScript", () => {
  it("the screen serves a noscript style that hides the button and shows the panel", () => {
    const html = renderToStaticMarkup(
      createElement(XornadaScreen, {
        ...props([MATCH]),
        recentGoal: { now: "2026-10-03T16:50:00Z", minutes: 5, mark: "label" },
      }),
    );
    const noscript = /<noscript>(.*?)<\/noscript>/s.exec(html)?.[1] ?? "";
    expect(noscript).toContain("<style>");
    expect(noscript).toMatch(/filtersToggle[^{]*\{\s*display:\s*none/);
    expect(noscript).toMatch(/filters[^{]*\{\s*display:\s*flex/);
  });
});

describe("SPEC-082 CA-3/CA-6 the CSS", () => {
  const css = readFileSync("src/components/xornada/Xornada.module.css", "utf8");
  const desktop = css.slice(css.indexOf("@media (min-width: 1024px)"));

  it("folds the panel on mobile until it is open", () => {
    expect(css).toMatch(
      /\.controls \.filters:not\(\[data-open\]\)\s*\{\s*display: none;/,
    );
  });

  it("on desktop the button is not painted and the filters are as they were", () => {
    expect(desktop).toMatch(/\.filtersToggle\s*\{\s*display: none;/);
    expect(desktop).toMatch(
      /\.controls \.filters:not\(\[data-open\]\)\s*\{\s*display: flex;/,
    );
  });

  it("the badge: --marca on --marca-ink, tabular digits, absolute", () => {
    const badge = /\.filtersBadge\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(badge).toContain("position: absolute");
    expect(badge).toContain("background: var(--marca)");
    expect(badge).toContain("color: var(--marca-ink)");
    expect(badge).toContain("font-variant-numeric: tabular-nums");
    const icon = /\.filtersToggle\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(icon).toContain("color: var(--fg-dim)");
  });
});

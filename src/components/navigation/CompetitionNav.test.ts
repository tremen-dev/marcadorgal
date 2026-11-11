import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ALLOWED_COMPETITIONS } from "../../model/index.ts";
import { CompetitionNav } from "./CompetitionNav.tsx";

describe("CompetitionNav Component", () => {
  it("renders category tabs and competition links in Galician", () => {
    const html = renderToStaticMarkup(
      createElement(CompetitionNav, {
        locale: "gl",
      }),
    );

    expect(html).toContain('data-testid="competition-nav"');
    expect(html).toContain("Fútbol Feminino");
    expect(html).toContain("Masculino");
    expect(html).toContain("Todo");
    expect(html).toContain("Liga F");
    expect(html).toContain('href="/competicion/liga-f"');
    expect(html).toContain('href="/competicion/primera-federacion-fem"');
    expect(html).toContain('href="/competicion/segunda-federacion-fem-g1"');
  });

  it("renders competition links with /es prefix in Spanish", () => {
    const html = renderToStaticMarkup(
      createElement(CompetitionNav, {
        locale: "es",
        currentCompetitionId: "liga-f",
      }),
    );

    expect(html).toContain("Fútbol Femenino");
    expect(html).toContain('href="/es/competicion/liga-f"');
    expect(html).toContain('href="/es/competicion/primera-federacion-fem"');
    expect(html).toContain('href="/es/competicion/segunda-federacion-fem-g1"');
  });

  it("filters initially by women category when specified", () => {
    const html = renderToStaticMarkup(
      createElement(CompetitionNav, {
        locale: "gl",
        initialCategory: "femenino",
      }),
    );

    expect(html).toContain("Liga F");
    expect(html).toContain("1ª Fed. Fem.");
    expect(html).toContain("2ª Fed. Fem. G1");
    expect(html).not.toContain("1ª División");
  });

  // SPEC-083 CA-1: the pills link to a league and only name it; the featured
  // team stays in CompetitionHeader.
  it("SPEC-083 CA-1 no pill names a team", () => {
    for (const locale of ["gl", "es"] as const) {
      const html = renderToStaticMarkup(
        createElement(CompetitionNav, { locale }),
      );
      expect(html).not.toContain("Depor ABANCA");
      expect(html).not.toContain("As Celtas");
      expect(html).not.toContain("featuredTeamTag");
    }
    const css = readFileSync(
      "src/components/navigation/CompetitionNav.module.css",
      "utf8",
    );
    expect(css).not.toContain(".featuredTeamTag");
  });

  // SPEC-083 CA-2: each dot paints the league's token.
  it("SPEC-083 CA-2 each dot is var(--liga-<id>)", () => {
    const html = renderToStaticMarkup(
      createElement(CompetitionNav, { locale: "gl" }),
    );
    const dots = [
      ...html.matchAll(
        /data-competition-id="([\w-]+)"[^>]*><span[^>]*style="background-color:([^"]+)"/g,
      ),
    ].map((m) => [m[1], m[2]]);
    expect(dots).toHaveLength(ALLOWED_COMPETITIONS.length);
    for (const [id, color] of dots) expect(color).toBe(`var(--liga-${id})`);
  });
});

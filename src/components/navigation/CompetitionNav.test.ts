import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
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
    expect(html).toContain("Depor ABANCA");
    expect(html).toContain("As Celtas");
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
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { COMPETITIONS_METADATA } from "../../model/index.ts";
import { CompetitionHeader } from "./CompetitionHeader.tsx";

// SPEC-083 CA-2: the badge of the competition paints its league's token;
// CA-1: the featured Galician team stays here.
describe("SPEC-083 CompetitionHeader", () => {
  it("CA-2 the badge is var(--liga-<id>) for every competition", () => {
    for (const competition of Object.values(COMPETITIONS_METADATA)) {
      const html = renderToStaticMarkup(
        createElement(CompetitionHeader, {
          competition,
          locale: "gl",
          activeTab: "overview",
        }),
      );
      const badge = html.match(
        /class="[^"]*badge[^"]*" style="background-color:([^"]+)"/,
      );
      expect(badge?.[1], competition.id).toBe(`var(--liga-${competition.id})`);
    }
  });

  it("CA-1 the featured team is still shown in the header", () => {
    const html = renderToStaticMarkup(
      createElement(CompetitionHeader, {
        competition: COMPETITIONS_METADATA["liga-f"],
        locale: "es",
        activeTab: "overview",
      }),
    );
    expect(html).toContain('data-testid="featured-galician-club"');
    expect(html).toContain("Deportivo ABANCA");
  });
});

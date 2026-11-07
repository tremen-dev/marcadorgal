import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LEGAL_DOCS_GL } from "@/lib/legal/content";
import { LegalPageView } from "./LegalPage";

describe("LegalPageView component (SPEC-058)", () => {
  it("renders a legal document with back link and sections", () => {
    const html = renderToStaticMarkup(
      createElement(LegalPageView, {
        document: LEGAL_DOCS_GL.avisoLegal,
        locale: "gl",
      }),
    );

    expect(html).toContain('data-testid="legal-page"');
    expect(html).toContain('href="/"');
    expect(html).toContain("Volver ao marcador");
    expect(html).toContain(LEGAL_DOCS_GL.avisoLegal.title);
    expect(html).toContain(LEGAL_DOCS_GL.avisoLegal.description);
    expect(html).toContain(LEGAL_DOCS_GL.avisoLegal.sections[0].title);
  });
});

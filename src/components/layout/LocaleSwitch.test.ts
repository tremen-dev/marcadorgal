import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Footer } from "./Footer";
import { LocaleLinks } from "./LocaleSwitch";

const render = (locale: "gl" | "es", pathname: string) =>
  renderToStaticMarkup(createElement(LocaleLinks, { locale, pathname }));

// SPEC-082 CA-2: gl·es lives in the footer, one selector per page.
describe("SPEC-082 CA-2 the footer's gl·es", () => {
  it("is one nav named xornada.locale, gl and es with hreflang and lang", () => {
    const html = render("gl", "/xornada/2026-11-03");
    expect(html.match(/data-testid="locale-switch"/g)).toHaveLength(1);
    expect(html).toMatch(/<nav[^>]*aria-label="Lingua"/);
    expect(html).toMatch(
      /<a[^>]*href="\/xornada\/2026-11-03"[^>]*hrefLang="gl"[^>]*lang="gl"[^>]*aria-current="page"/,
    );
    expect(html).toMatch(
      /<a[^>]*href="\/es\/xornada\/2026-11-03"[^>]*hrefLang="es"[^>]*lang="es"/,
    );
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it("marks es as current in /es and names the nav in Spanish", () => {
    const html = render("es", "/es/privacidad");
    expect(html).toMatch(/<nav[^>]*aria-label="Idioma"/);
    expect(html).toMatch(/<a[^>]*href="\/privacidade"[^>]*hrefLang="gl"/);
    expect(html).toMatch(
      /<a[^>]*href="\/es\/privacidad"[^>]*hrefLang="es"[^>]*aria-current="page"/,
    );
  });

  it("carries data-locale-href, so the xornada can add its fragment", () => {
    const html = render("gl", "/");
    expect(html).toContain('data-locale-href="/"');
    expect(html).toContain('data-locale-href="/es"');
  });

  it("is in the footer", () => {
    const html = renderToStaticMarkup(createElement(Footer, { locale: "gl" }));
    expect(html.match(/data-testid="locale-switch"/g)).toHaveLength(1);
  });
});

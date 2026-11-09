import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Footer } from "./Footer";

describe("Footer component (SPEC-058)", () => {
  it("renders all CA-1 to CA-5 elements in Galego", () => {
    const html = renderToStaticMarkup(createElement(Footer, { locale: "gl" }));

    // CA-1: Base markup
    expect(html).toContain('data-testid="app-footer"');

    // CA-2: tremen.dev lockup
    expect(html).toContain('href="https://tremen.dev"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("tremen");
    expect(html).toContain(".dev");
    expect(html).toContain("Un proxecto de");

    // CA-3: App version
    expect(html).toContain('data-testid="footer-version"');
    expect(html).toMatch(/v\d+\.\d+\.\d+/);

    // CA-4 & CA-5: Legal navigation links
    expect(html).toContain('href="/aviso-legal"');
    expect(html).toContain("Aviso legal");
    expect(html).toContain('href="/privacidade"');
    expect(html).toContain("Privacidade");
    expect(html).toContain('href="/cookies"');
    expect(html).toContain("Cookies");

    // Contact mailbox anti-spam presentation
    expect(html).toContain("ola [en] tremen.dev");

    // Disclaimer
    expect(html).toContain("Información deportiva sen valor oficial");
  });

  it("renders all CA-1 to CA-5 elements in Castellano", () => {
    const html = renderToStaticMarkup(createElement(Footer, { locale: "es" }));

    // CA-2: tremen.dev lockup
    expect(html).toContain("Un proyecto de");

    // CA-5: Legal navigation links in es
    expect(html).toContain('href="/es/aviso-legal"');
    expect(html).toContain('href="/es/privacidad"');
    expect(html).toContain('href="/es/cookies"');

    // Disclaimer
    expect(html).toContain("Información deportiva sin valor oficial");
  });
});

import { expect, test } from "@playwright/test";
import {
  FIXTURES,
  fixtureBytes,
  fixtureText,
} from "../src/sources/rfef/fixture-files.ts";
import { readPanel } from "../src/sources/rfef/panel.ts";

// SPEC-031 CA-3: the browser oracle. Each real fixture is painted by Chromium
// with JavaScript on and every other request aborted; only the .fa-0..9
// ::before rules of Font Awesome 6.5.1 go in, inline. For every .resu, the
// visible text (::before + children + ::after, nothing under display:none,
// read with getComputedStyle) must be what the parser reads from that row.

const FA_6_5_1_DIGITS = Array.from(
  { length: 10 },
  (_, n) => `.fa-${n}::before { content: "\\3${n}"; }`,
).join("\n");

const ORIGIN = "https://marcadores.rfef.es";

for (const fixture of FIXTURES) {
  test(`CA-3 oracle: ${fixture.name}`, async ({ page }) => {
    const url = `${ORIGIN}/oracle/${fixture.file}`;
    const charset = fixture.file.endsWith(".raw") ? "ISO-8859-15" : "utf-8";
    const aborted: string[] = [];
    await page.route("**/*", (route) => {
      if (route.request().url() === url)
        return route.fulfill({
          status: 200,
          contentType: `text/html;charset=${charset}`,
          body: Buffer.from(fixtureBytes(fixture.file)),
        });
      aborted.push(route.request().url());
      return route.abort();
    });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ content: FA_6_5_1_DIGITS });

    const painted = await page.$$eval(".resu", (cells) => {
      const pseudo = (el: Element, which: "::before" | "::after") => {
        const style = getComputedStyle(el, which);
        if (style.display === "none") return "";
        const content = style.content;
        if (content === "none" || content === "normal" || content === "")
          return "";
        const m = content.match(/^"(.*)"$/);
        return m ? m[1] : `[content ${content}]`;
      };
      const visible = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
        if (node.nodeType !== Node.ELEMENT_NODE) return "";
        const el = node as Element;
        if (getComputedStyle(el).display === "none") return "";
        return (
          pseudo(el, "::before") +
          [...el.childNodes].map(visible).join("") +
          pseudo(el, "::after")
        );
      };
      return cells.map((cell) => visible(cell).replace(/[\s ]+/g, ""));
    });

    const parsed = readPanel(fixtureText(fixture.name)).rows.map(
      (r) => r.cell.visible,
    );
    expect(painted.length).toBeGreaterThan(0);
    expect(parsed).toEqual(painted);
  });
}

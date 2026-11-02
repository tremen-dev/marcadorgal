import { mkdirSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { es } from "../src/i18n/es";
import { gl } from "../src/i18n/gl";

// SPEC-028 over the demo (Friday 2 to Monday 5 of October 2026): the logo
// goes home (CA-4) and the title says which xornada is on screen (CA-6), at
// the CA-7 widths. The sidebar of CA-1..CA-3 is gone (SPEC-040 CA-4).
const routes = [
  { path: "/demo/xornada", lang: "gl", dict: gl, home: "/", range: "2–5 out" },
  {
    path: "/es/demo/xornada",
    lang: "es",
    dict: es,
    home: "/es",
    range: "2–5 oct",
  },
] as const;

const WIDTHS = [360, 390, 1024, 1440] as const;
// QA_CAPTURE_DIR=docs/epicas/EPIC-003-xornada-publica/_qa/SPEC-028
const CAPTURES = process.env.QA_CAPTURE_DIR;

async function capture(page: Page, name: string) {
  if (!CAPTURES) return;
  mkdirSync(CAPTURES, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${CAPTURES}/${name}.png` });
}

const noPageScroll = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );

const sectionIds = (page: Page): Promise<string[]> =>
  page
    .getByTestId("competition")
    .evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-competition") ?? ""),
    );

for (const route of routes) {
  test.describe(`SPEC-028 ${route.path} (${route.lang})`, () => {
    // SPEC-040 CA-4/CA-5 (H-5, ADR-022 Anexo A): CA-1 and CA-3, and the
    // sidebar half of CA-2, went with the desktop sidebar. CA-2 below
    // (#xornada-<id> is not filter state) stays; the jump to a column is
    // e2e/xornada-columnas.spec.ts.
    for (const width of WIDTHS) {
      test(`CA-4 and CA-6 at ${width}px: logo home and the visible title`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route.path);
        const heading = `${route.dict.xornada.heading.replace("{range}", route.range)}`;
        const h1 = page.locator("h1");
        await expect(h1).toHaveCount(1);
        await expect(h1).toBeVisible();
        await expect(h1).toHaveText(heading);
        const text = h1.locator("span");
        await expect(text).toHaveCSS("font-weight", "600");
        await expect(text).toHaveCSS("font-size", "13px");
        expect(
          await text.evaluate((el) => getComputedStyle(el).boxShadow),
        ).toMatch(/inset/);
        const logo = page.getByTestId("home-link");
        await expect(logo).toHaveAttribute("href", route.home);
        await expect(logo).toHaveAccessibleName(route.dict.xornada.home);
        await expect(logo).toHaveCSS("text-decoration-line", "none");
        await logo.hover();
        await expect(logo).toHaveCSS("text-decoration-line", "none");
        // Nothing truncated, no page scroll (D-2).
        const truncated = await page
          .locator('h1, h1 span, [data-testid="home-link"]')
          .evaluateAll(
            (els) =>
              els.filter(
                (el) =>
                  el.scrollWidth > el.clientWidth ||
                  getComputedStyle(el).textOverflow === "ellipsis",
              ).length,
          );
        expect(truncated).toBe(0);
        expect(await noPageScroll(page)).toBe(true);

        const box = async (selector: string) => {
          const b = await page.locator(selector).first().boundingBox();
          if (b === null) throw new Error(selector);
          return b;
        };
        const title = await box("h1");
        if (width >= 1024) {
          // In the 56 px header, 28 px after the logo.
          const header = await box("header");
          const logoBox = await box('[data-testid="home-link"]');
          expect(header.height).toBe(56);
          expect(title.y).toBeGreaterThanOrEqual(header.y);
          expect(title.y + title.height).toBeLessThanOrEqual(
            header.y + header.height,
          );
          expect(Math.round(title.x - (logoBox.x + logoBox.width))).toBe(28);
        } else {
          // The 42 px row between the strip and the filters.
          const strip = await box('[data-testid="day-strip"]');
          const filters = await box('[data-testid="filters"]');
          expect(title.height).toBe(42);
          expect(Math.round(title.y)).toBe(Math.round(strip.y + strip.height));
          expect(Math.round(filters.y)).toBe(
            Math.round(title.y + title.height),
          );
        }
        // The range is the week's: choosing a day or a filter keeps it.
        await page.getByTestId("day-link").nth(1).click();
        await page.getByTestId("filter-finished").click();
        await expect(h1).toHaveText(heading);
        await page.getByTestId("day-link").nth(1).click();
        await page.getByTestId("filter-all").click();
        await capture(page, `titulo-${route.lang}-${width}`);

        // Focus ring on the logo by keyboard: the first stop of the page.
        await page.goto(route.path);
        await page.keyboard.press("Tab");
        await expect(logo).toBeFocused();
        expect(
          await logo.evaluate((el) => getComputedStyle(el).outlineStyle),
        ).not.toBe("none");
      });

      test(`CA-4 at ${width}px: from a filtered, folded, scrolled demo the logo goes to ${route.home}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 700 });
        await page.goto(`${route.path}#d=2026-10-03&f=finished`);
        await expect(page.getByTestId("filter-finished")).toHaveAttribute(
          "aria-current",
          "true",
        );
        for (const head of (
          await page.locator('[data-testid="competition-head"]:visible').all()
        ).slice(0, 2))
          await head.click();
        await page.evaluate(() => window.scrollTo(0, 200));
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.getByTestId("home-link").click();
        await page.waitForURL((url) => url.pathname === route.home);
        expect(
          await page.evaluate(() => ({
            path: location.pathname,
            hash: location.hash,
            y: window.scrollY,
          })),
        ).toEqual({ path: route.home, hash: "", y: 0 });
        await expect(page.locator("html")).toHaveAttribute("lang", route.lang);
        await expect(page.getByTestId("home-link")).toHaveAttribute(
          "href",
          route.home,
        );
        await expect(page.locator("h1")).toHaveCount(1);
      });
    }

    test("CA-2 with JavaScript: a #xornada-<id> fragment is not filter state", async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(route.path);
      const ids = await sectionIds(page);
      const total = await page.getByTestId("match-row").count();
      await page.goto(`${route.path}#xornada-${ids[2]}`);
      await page.reload();
      await expect(page.getByTestId("filter-all")).toHaveAttribute(
        "aria-current",
        "true",
      );
      await expect(
        page.locator('[data-testid="day-link"][aria-current]'),
      ).toHaveCount(0);
      await expect(
        page.locator('[data-testid="match-row"]:visible'),
      ).toHaveCount(total);
      expect(errors).toEqual([]);
    });

    test("CA-6 without JavaScript: the same title and logo", async ({
      browser,
    }) => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto(route.path);
      await expect(page.locator("h1")).toHaveText(
        route.dict.xornada.heading.replace("{range}", route.range),
      );
      await expect(page.getByTestId("home-link")).toHaveAttribute(
        "href",
        route.home,
      );
      await context.close();
    });
  });
}

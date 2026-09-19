import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { es } from "../src/i18n/es";
import { gl } from "../src/i18n/gl";

const routes = [
  { path: "/", lang: "gl", dict: gl, other: "/es" },
  { path: "/es", lang: "es", dict: es, other: "/" },
] as const;

const referencedFonts = (): string[] => {
  const css = readFileSync("src/app/globals.css", "utf8");
  return [...css.matchAll(/url\((\/fonts\/[^)]+\.woff2)\)/g)].map((m) => m[1]);
};

for (const route of routes) {
  test.describe(`${route.path} (${route.lang})`, () => {
    test("CA-3 h1 and paragraph come literally from the i18n file", async ({
      page,
    }) => {
      await page.goto(route.path);
      await expect(page.locator("h1")).toHaveText(route.dict.heading);
      await expect(page.locator("main p")).toHaveText(route.dict.waiting);
    });

    test("CA-4 responds 200 with the right <html lang>", async ({ page }) => {
      const response = await page.goto(route.path);
      expect(response?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", route.lang);
    });

    test("CA-4 language link leads to the other locale", async ({ page }) => {
      await page.goto(route.path);
      await page.getByRole("link", { name: route.dict.switchLocale }).click();
      await expect(page).toHaveURL(route.other);
    });

    test("CA-5 has the noindex meta", async ({ page }) => {
      await page.goto(route.path);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        "noindex, nofollow",
      );
    });

    test("CA-6 brand and tokens are applied", async ({ page }) => {
      await page.goto(route.path);
      const logo = page.getByTestId("logo");
      await expect(logo).toHaveText("marcador▮gal");
      const mark = page.getByTestId("logo-mark");
      await expect(mark).toHaveCSS("color", "rgb(86, 219, 143)");
      await expect(logo).toHaveCSS("font-weight", "800");
      await expect(logo).toHaveCSS("font-synthesis", "none");
      const body = page.locator("body");
      await expect(body).toHaveCSS("background-color", "rgb(17, 17, 16)");
      await expect(body).toHaveCSS("color", "rgb(245, 241, 234)");
      await expect(body).toHaveCSS("font-family", /^Geist/);
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(() => document.fonts.check("800 1em Geist")),
      ).toBe(true);
      const loaded800 = await page.evaluate(() =>
        [...document.fonts].some(
          (face) =>
            face.family.replace(/"/g, "") === "Geist" &&
            face.weight === "800" &&
            face.status === "loaded",
        ),
      );
      expect(loaded800).toBe(true);
    });

    test("CA-8 no third-party requests, no cookies, fonts served 200", async ({
      page,
      context,
      baseURL,
    }) => {
      const origin = new URL(baseURL ?? "").origin;
      const foreign: string[] = [];
      page.on("request", (request) => {
        if (!request.url().startsWith(origin)) foreign.push(request.url());
      });
      await page.goto(route.path);
      await page.evaluate(() => document.fonts.ready);
      expect(foreign).toEqual([]);
      expect(await context.cookies()).toEqual([]);
      const fonts = referencedFonts();
      expect(fonts.length).toBeGreaterThan(0);
      for (const font of fonts) {
        const response = await page.request.get(font);
        expect(response.status(), font).toBe(200);
      }
    });

    for (const viewport of [
      { width: 360, height: 640 },
      { width: 1440, height: 900 },
    ]) {
      test(`CA-9 at ${viewport.width}×${viewport.height}: no horizontal overflow, 44 px link, visible focus`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await page.goto(route.path);
        const overflow = await page.evaluate(() => {
          const el = document.documentElement;
          return el.scrollWidth - el.clientWidth;
        });
        expect(overflow).toBeLessThanOrEqual(0);
        const link = page.getByRole("link", { name: route.dict.switchLocale });
        const box = await link.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
        await page.keyboard.press("Tab");
        await expect(link).toBeFocused();
        const outline = await link.evaluate((el) => {
          const style = getComputedStyle(el);
          return { style: style.outlineStyle, width: style.outlineWidth };
        });
        expect(outline.style).not.toBe("none");
        expect(outline.width).not.toBe("0px");
      });
    }
  });
}

test("CA-4 /gl is not a route", async ({ page }) => {
  const response = await page.goto("/gl");
  expect(response?.status()).toBe(404);
});

import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { es } from "../src/i18n/es";
import { gl } from "../src/i18n/gl";

// SPEC-020 CA-6 and CA-7 without a database (CI: no DATABASE_URL_PUBLIC).
// The xornada is said to be unavailable, never shown empty. What the waiting
// page guaranteed (SPEC-001) still holds for the new home.
const routes = [
  { path: "/", lang: "gl", dict: gl, other: "/es" },
  { path: "/es", lang: "es", dict: es, other: "/" },
] as const;

const CACHE = "public, s-maxage=10, stale-while-revalidate=30";

const referencedFonts = (): string[] => {
  const css = readFileSync("src/app/globals.css", "utf8");
  return [...css.matchAll(/url\((\/fonts\/[^)]+\.woff2)\)/g)].map((m) => m[1]);
};

for (const route of routes) {
  test.describe(`${route.path} (${route.lang})`, () => {
    test("CA-6 unavailable: the i18n message and zero rows, with and without JS", async ({
      page,
      browser,
    }) => {
      const response = await page.goto(route.path);
      expect(response?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", route.lang);
      await expect(page.getByTestId("xornada-unavailable")).toHaveText(
        route.dict.xornada.unavailable,
      );
      await expect(page.getByTestId("match-row")).toHaveCount(0);
      await expect(page.getByTestId("competition")).toHaveCount(0);
      const context = await browser.newContext({ javaScriptEnabled: false });
      const noJs = await context.newPage();
      await noJs.goto(route.path);
      await expect(noJs.getByTestId("xornada-unavailable")).toHaveText(
        route.dict.xornada.unavailable,
      );
      await context.close();
    });

    test("CA-6 noindex (H-3)", async ({ page }) => {
      await page.goto(route.path);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        "noindex, nofollow",
      );
    });

    test("CA-7 the cache directives of ADR-014 §6", async ({ request }) => {
      const response = await request.get(route.path);
      expect(response.headers()["cache-control"]).toBe(CACHE);
    });

    test("locale switch leads to the same screen in the other language", async ({
      page,
    }) => {
      await page.goto(route.path);
      const switcher = page.getByTestId("locale-switch");
      await switcher
        .locator(`a[hreflang="${route.lang === "gl" ? "es" : "gl"}"]`)
        .click();
      await expect(page).toHaveURL(route.other);
    });

    test("no third-party requests, no cookies, fonts served 200", async ({
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

    test("tokens applied and no horizontal overflow at 360 px", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 360, height: 640 });
      await page.goto(route.path);
      const body = page.locator("body");
      await expect(body).toHaveCSS("background-color", "rgb(17, 17, 16)");
      await expect(body).toHaveCSS("color", "rgb(245, 241, 234)");
      await expect(body).toHaveCSS("font-family", /^Geist/);
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
}

test("CA-7 /api/board without a reader: 503 no-store", async ({ request }) => {
  const response = await request.get("/api/board");
  expect(response.status()).toBe(503);
  expect(response.headers()["cache-control"]).toBe("no-store");
});

test("/gl is not a route", async ({ page }) => {
  const response = await page.goto("/gl");
  expect(response?.status()).toBe(404);
});

import { mkdirSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { explorerAppPort } from "../playwright.config";
import { MEASURE } from "../src/design/tokens";
import { es } from "../src/i18n/es";
import { gl } from "../src/i18n/gl";
import { LEAGUES_PREFERENCES_KEY } from "../src/lib/league-preferences";
import { localePaths } from "../src/lib/locale-paths";
import { openFilters } from "./filters-panel";

// SPEC-082: a lighter mobile header. gl·es goes to the footer of every
// public page; on mobile the pills and «Ligas» fold behind one button.

const CAPTURES = "_qa/SPEC-082";
const MOBILE = [360, 390] as const;
const DESKTOP = [1024, 1440] as const;

const demos = [
  { path: "/demo/xornada", lang: "gl", dict: gl },
  { path: "/es/demo/xornada", lang: "es", dict: es },
] as const;

async function capture(page: Page, name: string) {
  mkdirSync(CAPTURES, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${CAPTURES}/${name}.png`, fullPage: false });
}

const noPageScroll = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );

test.describe("SPEC-082 CA-1 the header without gl·es", () => {
  for (const { path } of demos)
    for (const width of [...MOBILE, ...DESKTOP])
      test(`${path} at ${width} px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        const header = page.locator("header");
        await expect(header.getByTestId("locale-switch")).toHaveCount(0);
        await expect(header.locator("[hreflang]")).toHaveCount(0);
        expect((await header.boundingBox())?.height).toBe(
          width < MEASURE.breakpointDesktop
            ? MEASURE.barMobileHeader
            : MEASURE.barDesktopTop,
        );
      });
});

test.describe("SPEC-082 CA-2 gl·es in the footer of every public page", () => {
  const pages = [
    "/",
    "/es",
    "/demo/xornada",
    "/es/demo/xornada",
    "/directos",
    "/es/directos",
    "/aviso-legal",
    "/es/aviso-legal",
    "/privacidade",
    "/es/privacidad",
    "/cookies",
    "/es/cookies",
  ];
  // The competition pages read the Explorer: the build with its stand-in.
  const explorer = [
    "/competicion/primera-rfef-g1",
    "/es/competicion/primera-rfef-g1",
    "/clasificacion/primera-rfef-g1",
    "/es/clasificacion/primera-rfef-g1",
    "/calendario/primera-rfef-g1",
    "/es/calendario/primera-rfef-g1",
  ];
  const all = [
    ...pages.map((path) => ({ path, url: path })),
    ...explorer.map((path) => ({
      path,
      url: `http://localhost:${explorerAppPort}${path}`,
    })),
  ];
  for (const { path, url } of all)
    for (const width of [360, 1440])
      test(`${path} at ${width} px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(url);
        const lang = path === "/es" || path.startsWith("/es/") ? "es" : "gl";
        const dict = lang === "es" ? es : gl;
        await expect(page.getByTestId("locale-switch")).toHaveCount(1);
        const nav = page.getByTestId("app-footer").getByTestId("locale-switch");
        await expect(nav).toHaveAttribute("aria-label", dict.xornada.locale);
        const paths = localePaths(path);
        for (const other of ["gl", "es"] as const) {
          const link = nav.locator(`a[hreflang="${other}"]`);
          await expect(link).toHaveCount(1);
          await expect(link).toHaveAttribute("lang", other);
          await expect(link).toHaveAttribute("href", paths[other]);
          if (other === lang)
            await expect(link).toHaveAttribute("aria-current", "page");
          else await expect(link).not.toHaveAttribute("aria-current", /.*/);
          if (width < MEASURE.breakpointDesktop) {
            const box = await link.boundingBox();
            expect(box?.width).toBeGreaterThanOrEqual(44);
            expect(box?.height).toBeGreaterThanOrEqual(44);
          }
        }
        expect(await noPageScroll(page)).toBe(true);
      });

  test("the link keeps the xornada's fragment, outside [data-xornada]", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/demo/xornada#f=finished");
    const es = page.getByTestId("locale-switch").locator('a[hreflang="es"]');
    await expect(es).toHaveAttribute("href", "/es/demo/xornada#f=finished");
    await openFilters(page);
    await page.getByTestId("filter-live").click();
    await expect(es).toHaveAttribute("href", "/es/demo/xornada#f=live");
    await es.click();
    await expect(page).toHaveURL(/\/es\/demo\/xornada#f=live$/);
  });
});

test.describe("SPEC-082 CA-3 the folded filters button", () => {
  for (const { path, dict } of demos) {
    for (const width of MOBILE)
      test(`${path} at ${width} px: one button, the panel folded`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        const toggle = page.locator("header").getByTestId("filters-toggle");
        await expect(toggle).toBeVisible();
        await expect(toggle).toHaveAttribute("type", "button");
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        await expect(toggle).toHaveAttribute(
          "aria-label",
          dict.xornada.filters,
        );
        const panelId = await toggle.getAttribute("aria-controls");
        await expect(page.getByTestId("filters")).toHaveAttribute(
          "id",
          panelId ?? "",
        );
        await expect(toggle.locator("svg")).toHaveAttribute(
          "aria-hidden",
          "true",
        );
        await expect(toggle.locator("svg")).toHaveAttribute(
          "stroke",
          "currentColor",
        );
        const box = await toggle.boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(44);
        expect(box?.height).toBeGreaterThanOrEqual(44);
        // At the right of the bar, where gl·es was.
        const bar = await page.locator("header").boundingBox();
        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeGreaterThan(width - 20);
        expect(box?.y).toBeGreaterThanOrEqual(bar?.y ?? 0);
        expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(
          (bar?.y ?? 0) + (bar?.height ?? 0),
        );
        await expect(page.getByTestId("filters")).toBeHidden();
        await expect(
          page.getByTestId("leagues-preferences-trigger"),
        ).toBeHidden();
        // Right under the title row: what comes next is the list (the
        // freshness line on / and /es, SPEC-024 CA-8).
        const title = await page.getByTestId("xornada-title-row").boundingBox();
        const main = await page.locator("main").boundingBox();
        expect(
          Math.abs(
            (main?.y ?? 0) - ((title?.y ?? 0) + (title?.height ?? 0) + 1),
          ),
        ).toBeLessThanOrEqual(1.5);
        expect(await noPageScroll(page)).toBe(true);
        if (width === 360)
          await capture(page, `ca3-${path.replaceAll("/", "_")}-360-plegado`);
      });

    for (const width of DESKTOP)
      test(`${path} at ${width} px: no button, the filters as today`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await expect(page.getByTestId("filters-toggle")).toBeHidden();
        await expect(page.getByTestId("filters-toggle")).toHaveCSS(
          "display",
          "none",
        );
        await expect(page.getByTestId("filters")).toBeVisible();
        await expect(
          page.getByTestId("leagues-preferences-trigger"),
        ).toBeVisible();
        expect(await noPageScroll(page)).toBe(true);
        if (width === 1440)
          await capture(page, `ca3-${path.replaceAll("/", "_")}-1440`);
      });
  }
});

test.describe("SPEC-082 CA-4 open and fold", () => {
  for (const { path, dict } of demos)
    for (const width of MOBILE)
      test(`${path} at ${width} px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        const toggle = page.getByTestId("filters-toggle");
        const panel = page.getByTestId("filters");
        await openFilters(page);
        await expect(panel).toBeVisible();
        for (const id of ["filter-all", "filter-live", "filter-finished"])
          await expect(page.getByTestId(id)).toBeVisible();
        await expect(
          page.getByTestId("leagues-preferences-trigger"),
        ).toBeVisible();
        // In flow under the title row, over nothing.
        const title = await page.getByTestId("xornada-title-row").boundingBox();
        const box = await panel.boundingBox();
        const first = await page
          .getByTestId("competition")
          .first()
          .boundingBox();
        expect(box?.y).toBeGreaterThanOrEqual(
          (title?.y ?? 0) + (title?.height ?? 0),
        );
        expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(
          first?.y ?? 0,
        );
        expect(await noPageScroll(page)).toBe(true);

        // A pill: the filter applies, the panel folds, the focus goes back.
        await page.getByTestId("filter-live").click();
        await expect(page).toHaveURL(/#f=live$/);
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        await expect(panel).toBeHidden();
        await expect(toggle).toBeFocused();
        const rows = await page
          .getByTestId("match-row")
          .evaluateAll((els) =>
            els
              .filter((el) => (el as HTMLElement).checkVisibility())
              .map((el) => el.getAttribute("data-status")),
          );
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every((s) => s === "live")).toBe(true);

        // Escape with the focus in the panel folds it, focus on the button.
        await openFilters(page);
        await page.getByTestId("filter-all").focus();
        await page.keyboard.press("Escape");
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        await expect(toggle).toBeFocused();

        // «Ligas» opens its dialog and leaves the panel open.
        await openFilters(page);
        await page.getByTestId("leagues-preferences-trigger").click();
        await expect(
          page.getByTestId("leagues-preferences-dialog"),
        ).toBeVisible();
        await expect(toggle).toHaveAttribute("aria-expanded", "true");
        await page.getByTestId("preferences-close").click();
        await expect(
          page.getByTestId("leagues-preferences-dialog"),
        ).toHaveCount(0);
        await expect(panel).toBeVisible();

        // The button closes it as well.
        await toggle.click();
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        await expect(panel).toBeHidden();

        // Neither in the URL nor in localStorage: a reload starts folded.
        await openFilters(page);
        expect(page.url()).not.toMatch(/open|panel|filtros/i);
        const stored = await page.evaluate(() => JSON.stringify(localStorage));
        expect(stored).not.toMatch(/filters|panel|open/i);
        await page.reload();
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        await expect(panel).toBeHidden();
        await expect(toggle).toHaveAttribute(
          "aria-label",
          dict.xornada.filtersActive.one.replace("{n}", "1"),
        );
      });
});

test.describe("SPEC-082 CA-5 the mark of the active filters", () => {
  for (const { path, dict } of demos)
    test(`${path} at 360 px`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 900 });
      const one = dict.xornada.filtersActive.one.replace("{n}", "1");
      const two = dict.xornada.filtersActive.other.replace("{n}", "2");
      const toggle = page.getByTestId("filters-toggle");
      const badge = page.getByTestId("filters-badge");

      // n = 0: no badge, «Filtros».
      await page.goto(path);
      await expect(toggle).toHaveAttribute("aria-label", dict.xornada.filters);
      await expect(badge).toHaveCount(0);
      const before = await toggle.boundingBox();

      // Loading #f=live: 1.
      await page.goto(`${path}#f=live`);
      await page.reload();
      await expect(toggle).toHaveAttribute("aria-label", one);
      await expect(badge).toHaveText("1");
      await expect(badge).toHaveAttribute("aria-hidden", "true");
      await expect(badge).toHaveCSS("position", "absolute");
      await expect(badge).toHaveCSS("font-variant-numeric", "tabular-nums");
      expect(await toggle.boundingBox()).toEqual(before);

      // A league hidden from the dialog: 2, and the name says so.
      await openFilters(page);
      await page.getByTestId("leagues-preferences-trigger").click();
      await page.getByTestId("preset-pro").click();
      await page.getByTestId("preferences-close").click();
      await expect(toggle).toHaveAttribute("aria-label", two);
      await expect(badge).toHaveText("2");
      await capture(
        page,
        `ca5-${path.replaceAll("/", "_")}-360-abierto-insignia`,
      );

      // Todos: back to 1 (the leagues).
      await page.getByTestId("filter-all").click();
      await expect(toggle).toHaveAttribute("aria-label", one);
      await expect(badge).toHaveText("1");

      // Every league again (preset): 0, no badge.
      await openFilters(page);
      await page.getByTestId("leagues-preferences-trigger").click();
      await page.getByTestId("preset-all").click();
      await page.getByTestId("preferences-close").click();
      await expect(toggle).toHaveAttribute("aria-label", dict.xornada.filters);
      await expect(badge).toHaveCount(0);

      // A stored preference counts on load.
      await page.evaluate(
        ([key]) => localStorage.setItem(key, JSON.stringify(["liga-f"])),
        [LEAGUES_PREFERENCES_KEY],
      );
      await page.reload();
      await expect(toggle).toHaveAttribute("aria-label", one);
    });
});

test.describe("SPEC-082 CA-6 without JavaScript", () => {
  for (const { path } of demos)
    test(`${path} at 360 px: no button, the pills and «Ligas» as today`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        javaScriptEnabled: false,
        viewport: { width: 360, height: 900 },
      });
      const page = await context.newPage();
      await page.goto(path);
      await expect(page.getByTestId("filters-toggle")).toBeHidden();
      await expect(page.getByTestId("filters")).toBeVisible();
      for (const id of ["filter-all", "filter-live", "filter-finished"])
        await expect(page.getByTestId(id)).toBeVisible();
      await expect(
        page.getByTestId("leagues-preferences-trigger"),
      ).toBeVisible();
      expect(await noPageScroll(page)).toBe(true);
      await context.close();
    });

  for (const { path } of demos)
    test(`${path} at 360 px with JavaScript: the first paint is already folded`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 360, height: 900 });
      // Before any script runs (they never arrive), the HTML and its CSS.
      await page.route("**/_next/static/**/*.js", (route) => route.abort());
      await page.goto(path);
      await expect(page.getByTestId("filters-toggle")).toBeVisible();
      await expect(page.getByTestId("filters")).toBeHidden();
    });

  for (const { path } of demos)
    test(`${path} at 360 px: no layout shift in the header`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 360, height: 900 });
      await page.addInitScript(() => {
        const w = window as unknown as { __shifts: number[] };
        w.__shifts = [];
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries())
            w.__shifts.push((entry as unknown as { value: number }).value);
        }).observe({ type: "layout-shift", buffered: true });
      });
      await page.goto(path);
      await expect(page.getByTestId("filters-toggle")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);
      const shifts = await page.evaluate(
        () => (window as unknown as { __shifts: number[] }).__shifts,
      );
      expect(shifts.reduce((a, b) => a + b, 0)).toBeLessThan(0.01);
    });
});

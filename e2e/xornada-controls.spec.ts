import { mkdirSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { es } from "../src/i18n/es";
import { gl } from "../src/i18n/gl";

// SPEC-023: strip of days, filters, folding and desktop over the demo
// (Friday 2 to Monday 5 of October 2026; «now» is Saturday 3).
const routes = [
  {
    path: "/demo/xornada",
    lang: "gl",
    dict: gl,
    other: "/es/demo/xornada",
    days: ["ven 2", "SÁB 3", "dom 4", "lun 5"],
  },
  {
    path: "/es/demo/xornada",
    lang: "es",
    dict: es,
    other: "/demo/xornada",
    days: ["vie 2", "SÁB 3", "dom 4", "lun 5"],
  },
] as const;

const DATES = ["2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"];
const CAPTURES = process.env.QA_CAPTURE_DIR;

type Row = { status: string; day: string };

const visibleRows = (page: Page): Promise<Row[]> =>
  page.getByTestId("match-row").evaluateAll((rows) =>
    rows
      .filter((row) => (row as HTMLElement).checkVisibility())
      .map((row) => ({
        status: row.getAttribute("data-status") ?? "",
        day: row.getAttribute("data-day") ?? "",
      })),
  );

const allRows = (page: Page): Promise<Row[]> =>
  page.getByTestId("match-row").evaluateAll((rows) =>
    rows.map((row) => ({
      status: row.getAttribute("data-status") ?? "",
      day: row.getAttribute("data-day") ?? "",
    })),
  );

const noPageScroll = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );

async function capture(page: Page, name: string) {
  if (!CAPTURES) return;
  mkdirSync(CAPTURES, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${CAPTURES}/${name}.png` });
}

for (const route of routes) {
  test.describe(`SPEC-023 ${route.path} (${route.lang})`, () => {
    test("CA-2 strip: one link per day, today in capitals, nothing selected, no arrows", async ({
      page,
    }) => {
      await page.goto(route.path);
      const links = page.getByTestId("day-link");
      await expect(links).toHaveText([...route.days]);
      expect(
        await links.evaluateAll((els) =>
          els.map((el) => el.getAttribute("data-day-link")),
        ),
      ).toEqual(DATES);
      await expect(
        page.locator('[data-testid="day-link"][aria-current]'),
      ).toHaveCount(0);
      const strip = page.getByTestId("day-strip");
      expect(await strip.textContent()).not.toMatch(/[‹›]/);
      await expect(strip).toHaveCSS("overflow-x", "auto");
      await expect(page.getByTestId("filter-all")).toHaveAttribute(
        "aria-current",
        "true",
      );
    });

    test("CA-3 filter labels and counts over the whole xornada, tabular", async ({
      page,
    }) => {
      await page.goto(route.path);
      const rows = await allRows(page);
      const live = rows.filter((r) => r.status === "live").length;
      const finished = rows.filter((r) => r.status === "finished").length;
      await expect(page.getByTestId("filter-all")).toHaveText(
        `${route.dict.filter.all} ${rows.length}`,
      );
      await expect(page.getByTestId("filter-live")).toHaveText(
        `${route.dict.filter.live} ${live}`,
      );
      await expect(page.getByTestId("filter-finished")).toHaveText(
        `${route.dict.filter.finished} ${finished}`,
      );
      expect(await page.getByTestId("filters").textContent()).not.toMatch(
        /Directo/i,
      );
      for (const count of await page.locator("[data-count]").all()) {
        await expect(count).toHaveCSS("font-variant-numeric", "tabular-nums");
      }
    });

    test("CA-6 without JavaScript: every row, strip and filters, all open; links break nothing", async ({
      page,
      browser,
    }) => {
      await page.goto(route.path);
      const withJs = await allRows(page);
      const context = await browser.newContext({ javaScriptEnabled: false });
      const noJs = await context.newPage();
      const response = await noJs.goto(route.path);
      expect(response?.status()).toBe(200);
      expect(await allRows(noJs)).toEqual(withJs);
      expect(await visibleRows(noJs)).toHaveLength(withJs.length);
      await expect(noJs.getByTestId("day-strip")).toBeVisible();
      await expect(noJs.getByTestId("filters")).toBeVisible();
      const details = noJs.getByTestId("competition-details");
      await expect(details).toHaveCount(5);
      for (const d of await details.all()) {
        await expect(d).toHaveAttribute("open", "");
      }
      await noJs.getByTestId("day-link").nth(1).click();
      await noJs.getByTestId("filter-live").click();
      expect(await visibleRows(noJs)).toHaveLength(withJs.length);
      await expect(noJs.getByTestId("xornada-empty")).toBeHidden();
      // CA-5: folding works without JavaScript.
      const first = noJs.getByTestId("competition").first();
      await first.getByTestId("competition-head").click();
      await expect(first.getByTestId("match-row").first()).toBeHidden();
      await expect(first.getByTestId("competition-name")).toBeVisible();
      await context.close();
    });

    for (const width of [390, 1440]) {
      test(`CA-9 with JavaScript at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        const requests: string[] = [];
        await page.goto(route.path);
        await page.evaluate(() => {
          (window as unknown as { marker: number }).marker = 1;
        });
        page.on("request", (r) => requests.push(r.url()));
        const total = (await allRows(page)).length;

        // En xogo: only live rows, #f=live.
        await page.getByTestId("filter-live").click();
        await expect(page).toHaveURL(new RegExp(`${route.path}#f=live$`));
        await expect(page.getByTestId("filter-live")).toHaveAttribute(
          "aria-current",
          "true",
        );
        let rows = await visibleRows(page);
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every((r) => r.status === "live")).toBe(true);
        await capture(page, `en-xogo-${route.lang}-${width}`);
        await page.getByTestId("filter-all").click();
        await expect(page).toHaveURL(new RegExp(`${route.path}$`));
        expect(await visibleRows(page)).toHaveLength(total);

        // A day: only its rows, aria-current; again: everything back.
        const saturday = page.getByTestId("day-link").nth(1);
        await saturday.click();
        await expect(saturday).toHaveAttribute("aria-current", "true");
        await expect(page).toHaveURL(/#d=2026-10-03$/);
        rows = await visibleRows(page);
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every((r) => r.day === "2026-10-03")).toBe(true);
        await expect(page.getByTestId("filter-all")).toContainText(
          String(rows.length),
        );
        await expect(saturday).toHaveCSS("font-weight", "600");
        await capture(page, `dia-${route.lang}-${width}`);
        await saturday.click();
        await expect(saturday).not.toHaveAttribute("aria-current", "true");
        expect(await visibleRows(page)).toHaveLength(total);

        // Day and filter combine; nothing left says «nada aquí».
        await page.getByTestId("day-link").nth(0).click();
        await page.getByTestId("filter-live").click();
        await expect(page).toHaveURL(/#d=2026-10-02&f=live$/);
        await expect(page.getByTestId("xornada-empty")).toHaveText(
          route.dict.xornada.empty,
        );
        await expect(page.getByTestId("xornada-empty")).toBeVisible();
        expect(await visibleRows(page)).toHaveLength(0);
        await expect(
          page.locator('[data-testid="competition"]:visible'),
        ).toHaveCount(0);
        await capture(page, `nada-${route.lang}-${width}`);

        // gl·es keeps the fragment.
        await expect(
          page
            .getByTestId("locale-switch")
            .locator(`a[hreflang="${route.lang === "gl" ? "es" : "gl"}"]`),
        ).toHaveAttribute("href", `${route.other}#d=2026-10-02&f=live`);

        // No reload and nothing asked of the network.
        expect(
          await page.evaluate(
            () => (window as unknown as { marker?: number }).marker,
          ),
        ).toBe(1);
        expect(requests).toEqual([]);
      });

      test(`CA-9 loading #d=…&f=finished at ${width}px; an invalid fragment is ignored`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${route.path}#d=2026-10-04&f=finished`);
        await expect(page.getByTestId("day-link").nth(2)).toHaveAttribute(
          "aria-current",
          "true",
        );
        await expect(page.getByTestId("filter-finished")).toHaveAttribute(
          "aria-current",
          "true",
        );
        const rows = await visibleRows(page);
        expect(rows.length).toBeGreaterThan(0);
        expect(
          rows.every((r) => r.status === "finished" && r.day === "2026-10-04"),
        ).toBe(true);
        // A competition with no rows left is not painted.
        for (const section of await page.getByTestId("competition").all()) {
          const visible = await section
            .getByTestId("match-row")
            .evaluateAll((els) =>
              els.some((el) => (el as HTMLElement).checkVisibility()),
            );
          expect(await section.isVisible()).toBe(visible);
        }

        const total = (await allRows(page)).length;
        await page.goto(`${route.path}#d=2030-01-01&f=directo`);
        await page.reload();
        expect(await visibleRows(page)).toHaveLength(total);
        await expect(page.getByTestId("filter-all")).toHaveAttribute(
          "aria-current",
          "true",
        );
        await expect(
          page.locator('[data-testid="day-link"][aria-current]'),
        ).toHaveCount(0);
      });

      test(`CA-9 folding a competition at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route.path);
        const section = page.getByTestId("competition").nth(1);
        const rows = section.getByTestId("match-row");
        await section.getByTestId("competition-head").click();
        await expect(rows.first()).toBeHidden();
        await expect(section.getByTestId("competition-name")).toBeVisible();
        await section.getByTestId("competition-head").click();
        await expect(rows.first()).toBeVisible();
        if (width >= 1024) {
          const entry = page.getByTestId("sidebar-entry").nth(1);
          await entry.click();
          await expect(rows.first()).toBeHidden();
          await expect(entry).toHaveAttribute("aria-expanded", "false");
          await expect(page).toHaveURL(new RegExp(`${route.path}$`));
          await capture(page, `plegada-${route.lang}-${width}`);
          await entry.click();
          await expect(rows.first()).toBeVisible();
          await expect(entry).toHaveAttribute("aria-expanded", "true");
        } else {
          await expect(page.getByTestId("sidebar")).toBeHidden();
        }
      });
    }

    for (const width of [360, 390, 1024, 1440]) {
      test(`CA-8 nothing is truncated at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route.path);
        const selectors = [
          '[data-testid="team-name"]',
          '[data-testid="competition-name"]',
          '[data-testid="day-link"]',
          ...(width >= 1024 ? ['[data-testid="sidebar-name"]'] : []),
        ];
        const checked = await page
          .locator(selectors.join(", "))
          .evaluateAll((els) =>
            els.map((el) => ({
              text: el.textContent,
              truncated:
                el.scrollWidth > el.clientWidth ||
                getComputedStyle(el).textOverflow === "ellipsis",
            })),
          );
        expect(checked.length).toBeGreaterThan(40);
        expect(checked.filter((c) => c.truncated)).toEqual([]);
        expect(await noPageScroll(page)).toBe(true);
        for (const el of await page
          .locator('[data-testid="score"], [data-count]')
          .all()) {
          await expect(el).toHaveCSS("font-variant-numeric", "tabular-nums");
        }
        await capture(page, `xornada-${route.lang}-${width}`);
      });
    }

    test("CA-7 desktop at 1440px: 56 px header, 44 px bar, 236 px sidebar, rows up to 832 px", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(route.path);
      const box = async (selector: string) =>
        (await page.locator(selector).first().boundingBox()) ?? {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
        };
      expect((await box("header")).height).toBe(56);
      const strip = await box('[data-testid="day-strip"]');
      const filters = await box('[data-testid="filters"]');
      expect(
        Math.abs(strip.y + strip.height / 2 - (filters.y + filters.height / 2)),
      ).toBeLessThan(2);
      expect(filters.x).toBeGreaterThan(strip.x);
      const bar = await page
        .getByTestId("day-strip")
        .evaluate(
          (el) =>
            (el.parentElement as HTMLElement).getBoundingClientRect().height,
        );
      expect(bar).toBe(44);
      expect((await box('[data-testid="sidebar"]')).width).toBe(236);
      expect((await box("main")).width).toBeLessThanOrEqual(832);
      await expect(page.getByTestId("sidebar-entry")).toHaveCount(5);
      await expect(page.getByTestId("competition-round").first()).toBeVisible();
      await expect(page.getByTestId("competition-round").first()).toHaveText(
        route.dict.xornada.round.replace("{n}", "8"),
      );
      const text = (await page.locator("body").textContent()) ?? "";
      expect(text).not.toMatch(/[★☆]/);
      // The sidebar says the live count with its label, or the total.
      const first = page.getByTestId("sidebar-entry").first();
      await expect(first).toContainText(
        route.dict.xornada.liveCount.replace("{n}", "2"),
      );
      await expect(page.getByTestId("sidebar-entry").nth(4)).toContainText(
        route.dict.xornada.liveCount.replace("{n}", "1"),
      );
    });

    test("CA-7 mobile at 390px: the SPEC-019 layout plus strip and filters", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(route.path);
      expect((await page.locator("header").boundingBox())?.height).toBe(52);
      expect((await page.getByTestId("day-strip").boundingBox())?.height).toBe(
        40,
      );
      await expect(page.getByTestId("sidebar")).toBeHidden();
      await expect(page.getByTestId("competition-round").first()).toBeHidden();
      await expect(page.getByTestId("filters")).toBeVisible();
    });
  });
}

import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";
import { LOCAL_DATABASE_URL, noStripPort } from "../playwright.db.config";
import { seasonOf } from "../src/board/current";
import type { XornadaIndexEntry } from "../src/board/row";
import {
  homeWeek,
  neighbourWeeks,
  seasonWeeks,
  weekXornada,
} from "../src/board/weeks";
import { xornadaHeading } from "../src/components/xornada/labels";
import { es } from "../src/i18n/es";
import { gl } from "../src/i18n/gl";
import { xornadaDays } from "../src/xornada/view";
import { openFilters } from "./filters-panel";

// SPEC-072 CA-3, CA-4, CA-5: ‹ and › over the e2e:db seed, served as in
// production (SHOW_DAY_STRIP empty, noStripPort): they flank the title.
const origin = `http://localhost:${noStripPort}`;
const LANGS = [
  { lang: "gl", prefix: "", home: "/", dict: gl },
  { lang: "es", prefix: "/es", home: "/es", dict: es },
] as const;

let index: XornadaIndexEntry[];
let previous: string;
let first: string;

test.beforeAll(async () => {
  const sql = postgres(LOCAL_DATABASE_URL, { ssl: false, max: 1 });
  try {
    const now = new Date().toISOString();
    const rows =
      await sql`select match_id, competition_id, season, round, kickoff, status
      from web.xornada where season = ${seasonOf(now)}`;
    index = rows.map((r) => ({
      matchId: r.match_id,
      competitionId: r.competition_id,
      season: r.season,
      round: r.round,
      kickoff: r.kickoff.toISOString(),
      status: r.status,
    })) as XornadaIndexEntry[];
    const home = homeWeek(index, now) ?? "";
    const weeks = seasonWeeks(index);
    previous = neighbourWeeks(weeks, home).previous ?? "";
    first = weeks[0];
  } finally {
    await sql.end();
  }
  expect(previous).not.toBe("");
  expect(first < previous).toBe(true);
});

// The title of a week, as the page computes it from the days of its rows.
const headingOf = (week: string, lang: "gl" | "es") =>
  xornadaHeading(
    xornadaDays(weekXornada(index, week), new Date().toISOString()),
    lang,
  );

const box = async (page: Page, testId: string) => {
  const b = await page.getByTestId(testId).boundingBox();
  if (b === null) throw new Error(testId);
  return b;
};

const centre = (b: { y: number; height: number }) => b.y + b.height / 2;

for (const { lang, prefix, home, dict } of LANGS) {
  test.describe(`SPEC-072 without the strip (${lang})`, () => {
    test("CA-4 without JS: ‹ from the home to the previous week and › back; no ‹ on the first week", async ({
      browser,
    }) => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto(`${origin}${home}`);
      await expect(page.getByTestId("day-strip")).toHaveCount(0);
      await expect(page.getByTestId("week-previous")).toHaveCount(1);
      await expect(page.getByTestId("week-next")).toHaveCount(1);
      await page.getByTestId("week-previous").click();
      await expect(page).toHaveURL(`${origin}${prefix}/xornada/${previous}`);
      await expect(page.locator("h1")).toHaveText(headingOf(previous, lang));
      await page.getByTestId("week-next").click();
      await expect(page).toHaveURL(`${origin}${home}`);
      await page.goto(`${origin}${prefix}/xornada/${first}`);
      await expect(page.getByTestId("week-previous")).toHaveCount(0);
      await expect(page.getByTestId("week-previous-gap")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
      await context.close();
    });

    for (const width of [360, 390, 1440]) {
      test(`CA-3 at ${width}px: ‹ text › in the title's row, no new band, nothing truncated`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(`${origin}${home}`);
        // SPEC-082 CA-4: on mobile the panel is measured open.
        await openFilters(page);
        const h1 = page.locator("h1");
        await expect(h1).toHaveAccessibleName(/^[^‹›]+$/);
        expect(await h1.textContent()).not.toMatch(
          new RegExp(`[‹›]|${dict.xornada.previous}|${dict.xornada.next}`),
        );
        const prev = await box(page, "week-previous");
        const next = await box(page, "week-next");
        const text = await h1.locator("span").boundingBox();
        if (text === null) throw new Error("title text");
        expect(Math.abs(centre(prev) - centre(text))).toBeLessThanOrEqual(2);
        expect(Math.abs(centre(next) - centre(text))).toBeLessThanOrEqual(2);
        expect(prev.x + prev.width).toBeLessThanOrEqual(text.x + 0.5);
        expect(next.x).toBeGreaterThanOrEqual(text.x + text.width - 0.5);
        for (const b of [prev, next]) {
          expect(b.width).toBeGreaterThanOrEqual(24);
          expect(b.height).toBeGreaterThanOrEqual(24);
        }
        const header = await page.locator("header").boundingBox();
        const main = await page.locator("main").boundingBox();
        const filters = await box(page, "filters");
        // The controls bar that holds the filters (and the strip, if any).
        const controls = await page
          .getByTestId("filters")
          .locator("..")
          .boundingBox();
        if (header === null || main === null || controls === null)
          throw new Error("layout");
        if (width < 1024) {
          // The 42 px row under the header, as before (SPEC-061 CA-3): the
          // filters right under it and main right under the filters.
          const row = await box(page, "xornada-title-row");
          expect(row.height).toBe(42);
          expect(prev.y).toBeGreaterThanOrEqual(row.y - 0.5);
          expect(next.y + next.height).toBeLessThanOrEqual(
            row.y + row.height + 0.5,
          );
          expect(Math.round(filters.y)).toBe(Math.round(row.y + row.height));
        } else {
          expect(prev.y).toBeGreaterThanOrEqual(header.y - 0.5);
          expect(prev.y + prev.height).toBeLessThanOrEqual(
            header.y + header.height + 0.5,
          );
          // Desktop: the 56 px top bar and the 44 px controls bar, as before
          // (Escritorio.tpl.html); the filters need not fill the bar.
          expect(Math.round(header.height)).toBe(56);
          expect(Math.round(controls.y)).toBe(
            Math.round(header.y + header.height),
          );
          expect(Math.round(controls.height)).toBe(44);
        }
        // No new band: main starts right under the controls bar.
        expect(Math.round(main.y)).toBe(
          Math.round(controls.y + controls.height),
        );
        const truncated = await page
          .locator("h1, h1 span")
          .evaluateAll(
            (els) =>
              els.filter(
                (el) =>
                  el.scrollWidth > el.clientWidth ||
                  getComputedStyle(el).textOverflow === "ellipsis",
              ).length,
          );
        expect(truncated).toBe(0);
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth,
          ),
        ).toBe(true);
      });
    }

    test("CA-5 keyboard: ‹ before › before the filters; Enter navigates", async ({
      page,
    }) => {
      await page.goto(`${origin}${home}`);
      const order: string[] = [];
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press("Tab");
        const id = await page.evaluate(
          () => document.activeElement?.getAttribute("data-testid") ?? "",
        );
        if (id === "week-previous" || id === "week-next") {
          await expect(page.getByTestId(id)).not.toHaveCSS(
            "outline-style",
            "none",
          );
          order.push(id);
        }
        if (id === "filter-all") {
          order.push(id);
          break;
        }
      }
      expect(order).toEqual(["week-previous", "week-next", "filter-all"]);
      const arrow = page.getByTestId("week-previous");
      await expect(arrow).toHaveAttribute("aria-label", dict.xornada.previous);
      await arrow.focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(`${origin}${prefix}/xornada/${previous}`);
    });
  });
}

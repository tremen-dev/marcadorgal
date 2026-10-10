import { mkdirSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";
import { LOCAL_DATABASE_URL } from "../playwright.db.config";
import { seasonOf } from "../src/board/current";
import type { XornadaIndexEntry } from "../src/board/row";
import { homeWeek, neighbourWeeks, seasonWeeks } from "../src/board/weeks";
import { xornadaHeading } from "../src/components/xornada/labels";
import { xornadaDays } from "../src/xornada/view";

// SPEC-028 CA-4 and CA-6 over the local Supabase with the e2e:db seed: the
// logo goes back to the initial state of / (/es) from a filtered, folded,
// scrolled home and from a past week; the title says that week's dates.
// QA_CAPTURE_DIR=docs/epicas/EPIC-003-xornada-publica/_qa/SPEC-028
const CAPTURES = process.env.QA_CAPTURE_DIR;
const WIDTHS = [360, 390, 1024, 1440] as const;
const LANGS = [
  { lang: "gl", prefix: "", home: "/" },
  { lang: "es", prefix: "/es", home: "/es" },
] as const;

let previous: string;

test.beforeAll(async () => {
  const sql = postgres(LOCAL_DATABASE_URL, { ssl: false, max: 1 });
  try {
    const now = new Date().toISOString();
    const rows =
      await sql`select match_id, competition_id, season, round, kickoff, status
      from web.xornada where season = ${seasonOf(now)}`;
    const index = rows.map((r) => ({
      matchId: r.match_id,
      competitionId: r.competition_id,
      season: r.season,
      round: r.round,
      kickoff: r.kickoff.toISOString(),
      status: r.status,
    })) as XornadaIndexEntry[];
    const home = homeWeek(index, now) ?? "";
    previous = neighbourWeeks(seasonWeeks(index), home).previous ?? "";
  } finally {
    await sql.end();
  }
  expect(previous).not.toBe("");
});

async function capture(page: Page, name: string) {
  if (!CAPTURES) return;
  mkdirSync(CAPTURES, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${CAPTURES}/${name}.png` });
}

const stripDates = (page: Page): Promise<string[]> =>
  page
    .getByTestId("day-link")
    .evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-day-link") ?? ""),
    );

// CA-6: the title of the days on the strip (first and last).
const headingOf = (dates: string[], lang: "gl" | "es") =>
  xornadaHeading(
    xornadaDays(
      dates.map((d) => ({ kickoff: `${d}T12:00:00.000Z` })),
      new Date().toISOString(),
    ),
    lang,
  );

// CA-4: the initial state, read after the logo.
async function expectInitial(page: Page, home: string) {
  await page.waitForURL((url) => url.pathname === home && url.hash === "");
  await expect(page.getByTestId("match-row").first()).toBeVisible();
  const state = await page.evaluate(() => ({
    path: location.pathname,
    hash: location.hash,
    y: window.scrollY,
    closed: document.querySelectorAll("details:not([open])").length,
    days: document.querySelectorAll('[data-testid="day-link"][aria-current]')
      .length,
    all: document
      .querySelector('[data-testid="filter-all"]')
      ?.getAttribute("aria-current"),
    hidden: [
      ...document.querySelectorAll<HTMLElement>('[data-testid="match-row"]'),
    ].filter((r) => !r.checkVisibility()).length,
  }));
  expect(state).toEqual({
    path: home,
    hash: "",
    y: 0,
    closed: 0,
    days: 0,
    all: "true",
    hidden: 0,
  });
}

for (const { lang, prefix, home } of LANGS) {
  test.describe(`SPEC-028 (${lang})`, () => {
    for (const js of [true, false]) {
      test(`CA-4 ${js ? "with" : "without"} JS: from ${home}#d=…&f=finished, folded and scrolled, the logo resets`, async ({
        browser,
      }) => {
        const context = await browser.newContext({
          javaScriptEnabled: js,
          viewport: { width: 1440, height: 200 },
        });
        const page = await context.newPage();
        await page.goto(home);
        // A day with finished matches, so the filtered view is not empty.
        const day = await page
          .locator('[data-testid="match-row"][data-status="finished"]')
          .first()
          .getAttribute("data-day");
        expect(day).not.toBeNull();
        await page.goto(`${home}#d=${day}&f=finished`);
        if (js) {
          await page.reload();
          await expect(page.getByTestId("filter-finished")).toHaveAttribute(
            "aria-current",
            "true",
          );
        }
        const heads = page.locator('[data-testid="competition-head"]:visible');
        await heads.nth(0).click();
        await heads.nth(1).click();
        expect(
          await page.locator("details:not([open])").count(),
        ).toBeGreaterThanOrEqual(2);
        // Over the rows, not the sidebar (which scrolls inside itself).
        await page.mouse.move(900, 150);
        await page.mouse.wheel(0, 600);
        await expect
          .poll(() => page.evaluate(() => window.scrollY))
          .toBeGreaterThan(0);
        await page.getByTestId("home-link").click();
        await expectInitial(page, home);
        await context.close();
      });

      test(`CA-4 and CA-6 ${js ? "with" : "without"} JS: a past week says its dates and the logo goes to ${home}`, async ({
        browser,
      }) => {
        const context = await browser.newContext({ javaScriptEnabled: js });
        const page = await context.newPage();
        await page.goto(`${prefix}/xornada/${previous}`);
        const dates = await stripDates(page);
        expect(dates.length).toBeGreaterThan(0);
        await expect(page.locator("h1")).toHaveText(headingOf(dates, lang));
        await page.getByTestId("home-link").click();
        await expectInitial(page, home);
        await expect(page.locator("h1")).toHaveText(
          headingOf(await stripDates(page), lang),
        );
        await context.close();
      });
    }

    for (const width of WIDTHS) {
      test(`CA-6/CA-7 at ${width}px: the week title is whole, no page scroll`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${prefix}/xornada/${previous}`);
        const h1 = page.locator("h1");
        await expect(h1).toBeVisible();
        await expect(h1).toHaveText(headingOf(await stripDates(page), lang));
        const checks = await page
          .locator('h1, h1 span, [data-testid="home-link"]')
          .evaluateAll(
            (els) =>
              els.filter(
                (el) =>
                  el.scrollWidth > el.clientWidth ||
                  getComputedStyle(el).textOverflow === "ellipsis",
              ).length,
          );
        expect(checks).toBe(0);
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth,
          ),
        ).toBe(true);
        await capture(page, `semana-titulo-${lang}-${width}`);
      });
    }
  });
}

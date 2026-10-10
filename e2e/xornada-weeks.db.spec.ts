import { mkdirSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";
import { LOCAL_DATABASE_URL } from "../playwright.db.config";
import { seasonOf } from "../src/board/current";
import type { XornadaIndexEntry } from "../src/board/row";
import {
  homeWeek,
  neighbourWeeks,
  seasonWeeks,
  weekXornada,
} from "../src/board/weeks";
import { es } from "../src/i18n/es";
import { gl } from "../src/i18n/gl";

// SPEC-027 CA-3, CA-5 and CA-6 over the local Supabase with the e2e:db
// seed (the Realtime switch on). The expected weeks and rows are computed
// here from the same index the pages read.
const CACHE = "public, s-maxage=10, stale-while-revalidate=30";
// QA_CAPTURE_DIR=docs/epicas/EPIC-003-xornada-publica/_qa/SPEC-027
const CAPTURES = process.env.QA_CAPTURE_DIR;
const WIDTHS = [360, 390, 1024, 1440] as const;
const LANGS = [
  { lang: "gl", prefix: "", home: "/", dict: gl },
  { lang: "es", prefix: "/es", home: "/es", dict: es },
] as const;

let index: XornadaIndexEntry[];
let home: string;
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
    home = homeWeek(index, now) ?? "";
    const weeks = seasonWeeks(index);
    previous = neighbourWeeks(weeks, home).previous ?? "";
    first = weeks[0];
  } finally {
    await sql.end();
  }
  expect(home).not.toBe("");
  expect(previous).not.toBe("");
  expect(first < previous).toBe(true);
});

const ids = (page: Page): Promise<string[]> =>
  page
    .getByTestId("match-row")
    .evaluateAll((rows) =>
      rows.map((r) => r.getAttribute("data-match-id") ?? ""),
    );

const visibleRows = (page: Page) =>
  page.getByTestId("match-row").evaluateAll((rows) =>
    rows
      .filter((r) => (r as HTMLElement).checkVisibility())
      .map((r) => ({
        day: r.getAttribute("data-day"),
        status: r.getAttribute("data-status"),
      })),
  );

const noPageScroll = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );

for (const { lang, prefix, home: homePath, dict } of LANGS) {
  test.describe(`SPEC-027 (${lang})`, () => {
    test("CA-3 without JS: the rows of weekXornada and none of another week", async ({
      browser,
    }) => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      const path = `${prefix}/xornada/${previous}`;
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      expect(response?.headers()["cache-control"]).toBe(CACHE);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        "noindex, nofollow",
      );
      await expect(page.getByTestId("xornada-unavailable")).toHaveCount(0);
      const expected = weekXornada(index, previous).map((e) => e.matchId);
      expect(expected.length).toBeGreaterThan(10);
      expect([...(await ids(page))].sort()).toEqual([...expected].sort());
      // gl·es points at the pair.
      const switcher = page.getByTestId("locale-switch").locator("a");
      await expect(switcher.nth(0)).toHaveAttribute(
        "href",
        `/xornada/${previous}`,
      );
      await expect(switcher.nth(1)).toHaveAttribute(
        "href",
        `/es/xornada/${previous}`,
      );
      await context.close();
    });

    test("CA-3 answers: 308 to the Saturday, 307 to the home, 404 outside", async ({
      request,
    }) => {
      const monday = new Date(Date.parse(`${previous}T12:00:00Z`) + 2 * 864e5)
        .toISOString()
        .slice(0, 10);
      const get = (path: string) => request.get(path, { maxRedirects: 0 });
      // next start repeats an identical Location on a cache MISS
      // (F-SPEC-027-1); one value is what counts.
      const location = (r: { headers(): Record<string, string> }) => [
        ...new Set(r.headers().location.split(", ")),
      ];
      const permanent = await get(`${prefix}/xornada/${monday}`);
      expect(permanent.status()).toBe(308);
      expect(location(permanent)).toEqual([`${prefix}/xornada/${previous}`]);
      const temporary = await get(`${prefix}/xornada/${home}`);
      expect(temporary.status()).toBe(307);
      expect(location(temporary)).toEqual([homePath]);
      for (const missing of ["2099-08-15", "2026-02-30", "semana"])
        expect((await get(`${prefix}/xornada/${missing}`)).status()).toBe(404);
    });

    test("CA-5 a week page is a snapshot: no /api/board, no socket, no supabase-js; day, filter and fold work", async ({
      page,
    }) => {
      const board: string[] = [];
      const sockets: string[] = [];
      const scripts: Promise<string>[] = [];
      page.on("request", (r) => {
        if (r.url().includes("/api/board")) board.push(r.url());
      });
      page.on("websocket", (ws) => sockets.push(ws.url()));
      page.on("response", (r) => {
        if (/\.js(\?|$)/.test(r.url())) scripts.push(r.text().catch(() => ""));
      });
      await page.clock.install({ time: new Date() });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`${prefix}/xornada/${previous}`);
      const age = page.getByTestId("freshness-age");
      const servedAt = new RegExp(
        `^${dict.freshness.servedAt.replace("{time}", "\\d\\d:\\d\\d")}$`,
      );
      await expect(age).toHaveText(servedAt);
      await page.clock.fastForward("03:00");
      await expect(age).toHaveText(
        new RegExp(`^${dict.freshness.ago.replace("{n}", "\\d+")}$`),
      );
      const body = (await page.locator("body").textContent()) ?? "";
      expect(body).not.toContain(dict.freshness.polling);
      expect(body).not.toContain(dict.freshness.offline);

      // SPEC-023 CA-4/CA-9: a day leaves only its rows, with aria-current.
      const day = page.getByTestId("day-link").first();
      const date = (await day.getAttribute("data-day-link")) ?? "";
      await day.click();
      await expect(day).toHaveAttribute("aria-current", "true");
      expect(page.url()).toContain(`#d=${date}`);
      const rows = await visibleRows(page);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.day === date)).toBe(true);
      await day.click();
      expect(await visibleRows(page)).toHaveLength(
        weekXornada(index, previous).length,
      );
      // «En xogo»: only live rows, or «nada aquí».
      await page.getByTestId("filter-live").click();
      const live = await visibleRows(page);
      expect(live.every((r) => r.status === "live")).toBe(true);
      if (live.length === 0)
        await expect(page.getByTestId("xornada-empty")).toBeVisible();
      await page.getByTestId("filter-all").click();
      // SPEC-023 CA-5: folding from the header hides the rows, not the head
      // (SPEC-028: the sidebar no longer folds).
      const section = page.locator("section[data-competition]").first();
      await section.getByTestId("competition-head").click();
      await expect(
        section.getByTestId("match-row").filter({ visible: true }),
      ).toHaveCount(0);
      await expect(section.locator("summary")).toBeVisible();

      await page.clock.fastForward("01:00");
      expect(board).toEqual([]);
      expect(sockets).toEqual([]);
      expect(
        (await Promise.all(scripts)).some((s) =>
          /RealtimeClient|@supabase|phoenix/.test(s),
        ),
      ).toBe(false);
    });

    for (const width of WIDTHS) {
      test(`CA-6 arrows on ${homePath} and a week page at ${width}px: visible, whole, keyboard, no page scroll`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        for (const [path, arrows] of [
          [
            homePath,
            {
              previous: `${prefix}/xornada/${previous}`,
              next: `${prefix}/xornada/${neighbourWeeks(seasonWeeks(index), home).next}`,
            },
          ],
          [
            `${prefix}/xornada/${previous}`,
            {
              previous: `${prefix}/xornada/${neighbourWeeks(seasonWeeks(index), previous).previous}`,
              next: homePath,
            },
          ],
        ] as const) {
          await page.goto(path);
          for (const dir of ["previous", "next"] as const) {
            const arrow = page.getByTestId(`week-${dir}`);
            await expect(arrow).toBeVisible();
            await expect(arrow).toHaveAttribute("href", arrows[dir]);
            await expect(arrow).toHaveAttribute(
              "aria-label",
              dict.xornada[dir],
            );
            await expect(arrow.locator("span")).toHaveAttribute(
              "aria-hidden",
              "true",
            );
            const box = await arrow.boundingBox();
            expect(box?.width).toBeGreaterThanOrEqual(24);
            expect(box?.height).toBeGreaterThanOrEqual(24);
            expect(
              await arrow.evaluate((el) => el.scrollWidth <= el.clientWidth),
            ).toBe(true);
            // Outside the part that scrolls.
            expect(
              await arrow.evaluate(
                (el) => el.closest('[data-testid="day-strip"]') === null,
              ),
            ).toBe(true);
          }
          // ‹ before the first day, › after the last.
          const strip = await page.getByTestId("week-strip").boundingBox();
          const prev = await page.getByTestId("week-previous").boundingBox();
          const next = await page.getByTestId("week-next").boundingBox();
          const days = await page.getByTestId("day-strip").boundingBox();
          expect(prev && days && prev.x + prev.width <= days.x + 0.5).toBe(
            true,
          );
          expect(next && days && next.x >= days.x + days.width - 0.5).toBe(
            true,
          );
          expect(
            strip && next && next.x + next.width <= strip.x + strip.width + 0.5,
          ).toBe(true);
          expect(await noPageScroll(page)).toBe(true);
          // Reachable with the keyboard, with a visible ring.
          let reached = 0;
          for (let i = 0; i < 12 && reached < 2; i++) {
            await page.keyboard.press("Tab");
            const focused = await page.evaluate(() =>
              document.activeElement?.getAttribute("data-testid"),
            );
            if (focused === "week-previous" || focused === "week-next") {
              reached++;
              await expect(page.getByTestId(focused)).not.toHaveCSS(
                "outline-style",
                "none",
              );
            }
          }
          expect(reached).toBe(2);
          if (!CAPTURES) continue;
          mkdirSync(CAPTURES, { recursive: true });
          await page.evaluate(() => document.fonts.ready);
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({
            path: `${CAPTURES}/flechas-${path === homePath ? "portada" : "semana"}-${lang}-${width}.png`,
            clip: { x: 0, y: 0, width, height: width >= 1024 ? 220 : 260 },
          });
        }
      });
    }

    test("CA-6 without JS: ‹ on the home goes to the previous week and its › comes back; the first week has no ‹", async ({
      browser,
    }) => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto(homePath);
      await page.getByTestId("week-previous").click();
      await expect(page).toHaveURL(
        new RegExp(`${prefix}/xornada/${previous}$`),
      );
      expect(page.url()).not.toContain("#");
      await page.getByTestId("week-next").click();
      await expect(page).toHaveURL(new RegExp(`:\\d+${homePath}$`));
      await page.goto(`${prefix}/xornada/${first}`);
      await expect(page.getByTestId("week-previous")).toHaveCount(0);
      const gap = page.getByTestId("week-previous-gap");
      await expect(gap).toHaveAttribute("aria-hidden", "true");
      expect(await gap.evaluate((el) => el.matches("a, [tabindex]"))).toBe(
        false,
      );
      expect((await gap.boundingBox())?.width).toBe(
        (await page.getByTestId("week-next").boundingBox())?.width,
      );
      if (CAPTURES)
        await page.screenshot({
          path: `${CAPTURES}/flechas-primera-semana-${lang}.png`,
          clip: { x: 0, y: 0, width: 1280, height: 220 },
        });
      await context.close();
    });
  });
}

test("CA-3 the names of a week are the same in gl and es", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const names = async (path: string) => {
    await page.goto(path);
    return page
      .getByTestId("team-name")
      .evaluateAll((els) => els.map((el) => el.textContent ?? ""));
  };
  const glNames = await names(`/xornada/${previous}`);
  expect(glNames.length).toBeGreaterThan(20);
  expect(await names(`/es/xornada/${previous}`)).toEqual(glNames);
  await context.close();
});

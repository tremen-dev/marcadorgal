import { mkdirSync } from "node:fs";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { es } from "../src/i18n/es";
import { gl } from "../src/i18n/gl";

// SPEC-040 CA-5 and CA-6 over the demonstration (Friday 2 to Monday 5 of
// October 2026, the five competitions): desktop in 360 px columns without the
// sidebar; a date per row; nothing truncated.
const routes = [
  { path: "/demo/xornada", lang: "gl", dict: gl },
  { path: "/es/demo/xornada", lang: "es", dict: es },
] as const;

// CA-5: distinct `left` values of the competitions at each width.
const COLUMNS: readonly [number, number][] = [
  [390, 1],
  [1024, 2],
  [1280, 3],
  [1440, 3],
  [1536, 4],
  [1920, 5],
  [2200, 5],
];
const CA6_WIDTHS = [360, 390, 1024, 1280, 1440, 1536, 1920, 2200] as const;
const CAPTURE_WIDTHS = new Set([390, 1024, 1536, 1920]);
// QA_CAPTURE_DIR=docs/epicas/EPIC-003-xornada-publica/_qa/SPEC-040
const CAPTURES = process.env.QA_CAPTURE_DIR;

async function capture(page: Page, name: string) {
  if (!CAPTURES) return;
  mkdirSync(CAPTURES, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${CAPTURES}/${name}.png`, fullPage: true });
}

type Box = { id: string; left: number; top: number; width: number };

const boxes = (page: Page): Promise<Box[]> =>
  page.getByTestId("competition").evaluateAll((els) =>
    els
      .filter((el) => (el as HTMLElement).checkVisibility())
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          id: el.getAttribute("data-competition") ?? "",
          left: Math.round(r.left),
          top: Math.round(r.top + window.scrollY),
          width: r.width,
        };
      }),
  );

const distinct = (values: number[]): number[] =>
  [...new Set(values)].sort((a, b) => a - b);

async function open(
  browser: Browser,
  page: Page,
  width: number,
  path: string,
  js = true,
) {
  if (js) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(path);
    return { page, close: async () => {} };
  }
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width, height: 900 },
  });
  const noJs = await context.newPage();
  await noJs.goto(path);
  return { page: noJs, close: () => context.close() };
}

for (const route of routes) {
  test.describe(`SPEC-040 ${route.path} (${route.lang})`, () => {
    const cases = [
      ...COLUMNS.map(([w, n]) => [w, n, true] as const),
      [1536, 4, false] as const,
    ];
    for (const [width, n, js] of cases) {
      test(`CA-5 at ${width}px ${js ? "with" : "without"} JS: ${n} column(s), no sidebar, DOM order`, async ({
        page: jsPage,
        browser,
      }) => {
        const { page, close } = await open(
          browser,
          jsPage,
          width,
          route.path,
          js,
        );
        const seen = await boxes(page);
        expect(seen).toHaveLength(5);
        expect(distinct(seen.map((b) => b.left))).toHaveLength(n);
        // No sidebar: no entry, no competition nav, nothing of it.
        await expect(page.getByTestId("sidebar")).toHaveCount(0);
        await expect(page.locator("[data-competition-link]")).toHaveCount(0);
        await expect(page.locator("main nav")).toHaveCount(0);
        await expect(page.locator("nav")).toHaveCount(3);
        if (width >= 1024)
          for (const b of seen) expect(b.width, b.id).toBe(360);
        // Ordered by (top, left) they are the DOM order; a row of columns
        // shares its top.
        const sorted = [...seen].sort(
          (a, b) => a.top - b.top || a.left - b.left,
        );
        expect(sorted.map((b) => b.id)).toEqual(seen.map((b) => b.id));
        for (let i = 0; i < seen.length; i += n) {
          const row = seen.slice(i, i + n);
          expect(distinct(row.map((b) => b.top)), `row ${i / n}`).toHaveLength(
            1,
          );
        }
        // The grid is left-aligned, 16 px in, 16 px apart.
        if (width >= 1024) {
          const lefts = distinct(seen.map((b) => b.left));
          expect(lefts[0]).toBe(16);
          lefts.forEach((left, i) => {
            expect(left).toBe(16 + i * (360 + 16));
          });
        }
        if (CAPTURE_WIDTHS.has(width) && js)
          await capture(page, `columnas-${route.lang}-${width}`);
        await close();
      });
    }

    for (const width of [1024, 1536, 1920]) {
      test(`CA-5 at ${width}px: counters follow En xogo and a day; the rest fill the first cells; folding moves nothing`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route.path);
        const all = await boxes(page);
        // A cell is its left and the row of columns it is in.
        const slots = (bs: Box[]) => {
          const tops = distinct(bs.map((b) => b.top));
          return bs.map((b) => ({ left: b.left, row: tops.indexOf(b.top) }));
        };
        const cells = slots(all);

        // Every header shows its counter in words: «N en xogo» while a row
        // left is live, else the total of the rows left.
        const counters = () =>
          page.getByTestId("competition").evaluateAll((els) =>
            els
              .filter((el) => (el as HTMLElement).checkVisibility())
              .map((el) => {
                const shown = [
                  ...el.querySelectorAll<HTMLElement>(
                    '[data-testid="live-pill"], [data-testid="competition-total"]',
                  ),
                ].filter((c) => c.checkVisibility());
                const rows = [
                  ...el.querySelectorAll<HTMLElement>(
                    '[data-testid="match-row"]',
                  ),
                ].filter((r) => !r.hidden);
                return {
                  id: el.getAttribute("data-competition") ?? "",
                  text: shown.map((c) => c.innerText.trim()).join("|"),
                  rows: rows.length,
                  live: rows.filter((r) => r.dataset.status === "live").length,
                };
              }),
          );
        const check = async () => {
          const seen = await counters();
          for (const c of seen) {
            const want =
              c.live > 0
                ? route.dict.xornada.liveCount.replace("{n}", String(c.live))
                : (c.rows === 1
                    ? route.dict.xornada.matchCountOne
                    : route.dict.xornada.matchCount
                  ).replace("{n}", String(c.rows));
            expect(c.text, c.id).toBe(want);
          }
          return seen.map(({ id, text }) => ({ id, text }));
        };
        const before = await check();
        expect(before).toHaveLength(5);

        // En xogo: every competition of the demo has a live match, so the
        // live counts stay and all five keep their cells, in order.
        await page.getByTestId("filter-live").click();
        await expect(page).toHaveURL(/#f=live$/);
        await check();
        expect(slots(await boxes(page))).toEqual(cells);
        await capture(page, `columnas-en-xogo-${route.lang}-${width}`);
        // Rematados: no live left, the counters change to the totals.
        await page.getByTestId("filter-finished").click();
        expect(await check()).not.toEqual(before);
        await page.getByTestId("filter-all").click();

        // A day: the counters follow it; the competitions left take the
        // first cells, in order.
        await page.getByTestId("day-link").nth(0).click();
        await expect(page).toHaveURL(/#d=2026-10-02$/);
        const friday = await check();
        expect(friday).not.toEqual(before);
        const fridayBoxes = await boxes(page);
        expect(fridayBoxes.length).toBeLessThan(5);
        expect(slots(fridayBoxes)).toEqual(cells.slice(0, fridayBoxes.length));
        expect(fridayBoxes.map((b) => b.id)).toEqual(
          all.map((b) => b.id).filter((id) => friday.some((f) => f.id === id)),
        );
        await capture(page, `columnas-dia-${route.lang}-${width}`);
        await page.getByTestId("day-link").nth(0).click();
        expect(await check()).toEqual(before);

        // Folding one keeps its header and moves no other column.
        const second = page.getByTestId("competition").nth(1);
        await second.getByTestId("competition-head").click();
        await expect(second.getByTestId("match-row").first()).toBeHidden();
        await expect(second.getByTestId("competition-name")).toBeVisible();
        const folded = await boxes(page);
        expect(folded.map((b) => b.left)).toEqual(all.map((b) => b.left));
        await capture(page, `columnas-plegada-${route.lang}-${width}`);
      });
    }

    test("CA-5 /#xornada-<id> takes you to its column, unfiltered", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1024, height: 500 });
      await page.goto(route.path);
      const total = await page.getByTestId("match-row").count();
      const ids = await page
        .getByTestId("competition")
        .evaluateAll((els) =>
          els.map((el) => el.getAttribute("data-competition") ?? ""),
        );
      const target = ids[ids.length - 1];
      await page.goto(`${route.path}#xornada-${target}`);
      await page.reload();
      const section = page.locator(`#xornada-${target}`);
      await expect(section.getByTestId("competition-head")).toBeInViewport();
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
      await expect(section).toHaveCSS("scroll-margin-top", "16px");
      await expect(
        page.locator('[data-testid="match-row"]:visible'),
      ).toHaveCount(total);
      await expect(page.getByTestId("filter-all")).toHaveAttribute(
        "aria-current",
        "true",
      );
    });

    for (const width of CA6_WIDTHS) {
      test(`CA-6 at ${width}px: nothing truncated, a date per row, level margins`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route.path);
        await page.evaluate(() => document.fonts.ready);
        const truncated = await page
          .locator(
            '[data-testid="match-margin"], [data-testid="match-margin-sub"], [data-testid="team-name"], [data-testid="competition-name"], [data-testid="live-pill"], [data-testid="competition-total"]',
          )
          .evaluateAll((els) =>
            els
              .filter((el) => (el as HTMLElement).checkVisibility())
              .filter(
                (el) =>
                  el.scrollWidth > el.clientWidth ||
                  getComputedStyle(el).textOverflow === "ellipsis",
              )
              .map((el) => el.textContent),
          );
        expect(truncated).toEqual([]);
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth,
          ),
        ).toBe(true);
        for (const score of await page.getByTestId("score").all())
          await expect(score).toHaveCSS("font-variant-numeric", "tabular-nums");

        // Every row not live has the date of its kickoff; no live row does;
        // no day header anywhere.
        await expect(page.getByTestId("day-header")).toHaveCount(0);
        const rows = await page.getByTestId("match-row").evaluateAll((els) =>
          els.map((el) => ({
            status: el.getAttribute("data-status") ?? "",
            day: Number((el.getAttribute("data-day") ?? "").slice(8)),
            sub:
              el.querySelector('[data-testid="match-margin-sub"]')
                ?.textContent ?? "",
          })),
        );
        for (const r of rows) {
          if (r.status === "live") expect(r.sub).not.toMatch(/^\S+ \d+ \S+$/);
          else expect(r.sub).toMatch(new RegExp(`^\\S+ ${r.day} \\S+$`));
        }

        // The margin of a live row (minute, half-time, no minute) and of a
        // scheduled one measure the same; their lines sit level (±1 px).
        const half = route.dict.xornada.halfTime.toLocaleUpperCase(route.lang);
        const kinds = await page
          .getByTestId("match-row")
          .evaluateAll((els, half) => {
            const measure = (row: Element) => {
              const r = row.getBoundingClientRect();
              const top = (testid: string) =>
                (
                  row.querySelector(`[data-testid="${testid}"]`) as HTMLElement
                ).getBoundingClientRect().top - r.top;
              return {
                height: (
                  row.querySelector(
                    '[data-testid="match-margin-lines"]',
                  ) as HTMLElement
                ).getBoundingClientRect().height,
                main: top("match-margin"),
                sub: top("match-margin-sub"),
              };
            };
            const kind = (row: Element): string | null => {
              const status = row.getAttribute("data-status");
              if (status === "scheduled") return "scheduled";
              if (status !== "live") return null;
              if (row.getAttribute("data-qualifier") !== "confirmado")
                return null;
              const sub = row.querySelector(
                '[data-testid="match-margin-sub"]',
              ) as HTMLElement;
              if (sub.textContent === "") return "noMinute";
              if (sub.textContent === half) return "halfTime";
              return "minute";
            };
            const found: Record<string, ReturnType<typeof measure>> = {};
            for (const row of els) {
              const k = kind(row);
              if (k !== null && !(k in found)) found[k] = measure(row);
            }
            return found;
          }, half);
        expect(Object.keys(kinds).sort()).toEqual([
          "halfTime",
          "minute",
          "noMinute",
          "scheduled",
        ]);
        const ref = kinds.scheduled;
        expect(ref.height).toBeGreaterThan(0);
        for (const [kind, k] of Object.entries(kinds)) {
          expect(k.height, kind).toBe(ref.height);
          expect(Math.abs(k.main - ref.main), kind).toBeLessThanOrEqual(1);
          expect(Math.abs(k.sub - ref.sub), kind).toBeLessThanOrEqual(1);
        }
        if (CAPTURE_WIDTHS.has(width))
          await capture(page, `filas-${route.lang}-${width}`);
      });
    }
  });
}

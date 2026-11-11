import { mkdirSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { PROVISIONAL_DISPLAY } from "../src/app/config";
import { COLORS } from "../src/design/tokens";
import { es } from "../src/i18n/es";
import { gl } from "../src/i18n/gl";
import { openFilters } from "./filters-panel";

// SPEC-034 CA-6 over the demonstration. SPEC-084 CA-3: the three modes by
// ?provisional= (only in the demo). mark: the glyph * in each provisional
// row, one legend at the foot of the list that follows the visible rows.
// label: the word. hidden (the default, SPEC-084 CA-2): nothing seen nor
// read, no legend. In all of them sen sinal keeps its label (D-9).
const routes = [
  { path: "/demo/xornada", lang: "gl", dict: gl },
  { path: "/es/demo/xornada", lang: "es", dict: es },
] as const;

const FRIDAY = "2026-10-02";
const SATURDAY = "2026-10-03";
const CAPTURES = process.env.QA_CAPTURE_DIR;

const rgb = (value: string): string => {
  const [r, g, b] = [1, 3, 5].map((i) =>
    Number.parseInt(value.slice(i, i + 2), 16),
  );
  return `rgb(${r}, ${g}, ${b})`;
};
const AMBER = rgb(COLORS.amber.value);
const MUTED = rgb(COLORS.fgMuted.value);

async function capture(page: Page, name: string) {
  if (!CAPTURES) return;
  mkdirSync(CAPTURES, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${CAPTURES}/${name}.png`, fullPage: true });
}

const legend = (page: Page) => page.getByTestId("provisional-legend");

type Dict = typeof gl | typeof es;

// The provisional rows on the screen: some live, some finished.
async function provisionalRows(page: Page) {
  const provisional = page.locator(
    'li[data-qualifier="provisional"]:not([hidden])',
  );
  expect(await provisional.count()).toBeGreaterThan(0);
  const statuses = new Set(
    await provisional.evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-status")),
    ),
  );
  expect(statuses).toContain("live");
  expect(statuses).toContain("finished");
  return provisional.all();
}

// D-9: sen sinal keeps its label in every mode, never the glyph.
async function checkNoSignal(page: Page, dict: Dict) {
  const noSignal = page.locator('li[data-qualifier="sen_sinal"]');
  expect(await noSignal.count()).toBeGreaterThan(0);
  for (const row of await noSignal.all()) {
    await expect(row.getByTestId("match-qualifier")).toHaveText(
      dict.qualifier.sen_sinal,
    );
    await expect(row.getByTestId("provisional-mark")).toHaveCount(0);
  }
}

// D-2: nothing truncated, no horizontal page scroll.
async function checkNothingCut(page: Page) {
  const truncated = await page
    .locator(
      '[data-testid="provisional-legend"], [data-testid="provisional-mark"], [data-testid="match-qualifier"], [data-testid="team-name"]',
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
}

// SPEC-084 CA-2 (SPEC-034 CA-4), hidden: no glyph, no label, not even the
// word for screen readers, no legend in the DOM; data-qualifier stays.
async function checkHidden(page: Page, dict: Dict) {
  for (const row of await provisionalRows(page)) {
    await expect(row).toHaveAttribute("data-qualifier", "provisional");
    await expect(row.getByTestId("provisional-mark")).toHaveCount(0);
    await expect(row.getByTestId("match-qualifier")).toHaveCount(0);
    expect(await row.textContent()).not.toContain(dict.qualifier.provisional);
  }
  await expect(page.getByTestId("provisional-mark")).toHaveCount(0);
  await expect(legend(page)).toHaveCount(0);
  await expect(page.locator("[data-provisional-legend]")).toHaveCount(0);
  await checkNoSignal(page, dict);
  await checkNothingCut(page);
}

// SPEC-034 CA-2, label: the word next to the margin, amber; no glyph, no
// legend.
async function checkLabel(page: Page, dict: Dict) {
  for (const row of await provisionalRows(page)) {
    const label = row.getByTestId("match-qualifier");
    await expect(label).toBeVisible();
    await expect(label).toHaveText(dict.qualifier.provisional);
    await expect(label).toHaveCSS("color", AMBER);
    await expect(row.getByTestId("provisional-mark")).toHaveCount(0);
  }
  await expect(legend(page)).toHaveCount(0);
  await checkNoSignal(page, dict);
  await checkNothingCut(page);
}

// The screen in mark: what every provisional and sen sinal row shows, the
// legend's letter, nothing truncated, no horizontal scroll.
async function checkMark(page: Page, dict: Dict) {
  for (const row of await provisionalRows(page)) {
    const mark = row.getByTestId("provisional-mark");
    await expect(mark).toBeVisible();
    await expect(mark).toHaveText("*");
    await expect(mark).toHaveAttribute("aria-hidden", "true");
    await expect(mark).toHaveCSS("color", AMBER);
    // The word is for screen readers only; no visible label.
    await expect(row.getByTestId("match-qualifier")).toHaveCount(0);
    await expect(row).toContainText(dict.qualifier.provisional);
  }
  await checkNoSignal(page, dict);

  await expect(legend(page)).toHaveCount(1);
  await expect(legend(page)).toBeVisible();
  await expect(legend(page)).toHaveText(dict.qualifier.provisionalLegend);
  await expect(legend(page)).toHaveCSS("color", MUTED);
  await expect(legend(page)).toHaveCSS("text-transform", "none");
  await expect(legend(page)).toHaveCSS("font-size", "11px");
  // At the foot of the list: after the last row.
  expect(
    await page.evaluate(() => {
      const rows = document.querySelectorAll('[data-testid="match-row"]');
      const foot = document.querySelector("[data-provisional-legend]");
      const last = rows[rows.length - 1];
      return (
        foot !== null &&
        last !== undefined &&
        (last.compareDocumentPosition(foot) &
          Node.DOCUMENT_POSITION_FOLLOWING) !==
          0
      );
    }),
  ).toBe(true);

  await checkNothingCut(page);
}

test("SPEC-084 CA-1 the default mode is hidden", () => {
  expect(PROVISIONAL_DISPLAY).toBe("hidden");
});

// SPEC-084 CA-3: absent, or not exactly a mode, it is the default (hidden).
const HIDDEN_QUERIES = ["", "?provisional=hidden", "?provisional=Mark"];

for (const route of routes) {
  const mark = `${route.path}?provisional=mark`;
  const label = `${route.path}?provisional=label`;
  test.describe(`${route.path} (${route.lang})`, () => {
    for (const width of [390, 1440]) {
      for (const query of HIDDEN_QUERIES) {
        test(`SPEC-084 CA-2 hidden at ${width}px with JS (${query || "default"})`, async ({
          page,
        }) => {
          await page.setViewportSize({ width, height: 900 });
          await page.goto(`${route.path}${query}`);
          await checkHidden(page, route.dict);
          if (query === "")
            await capture(page, `oculto-${route.lang}-${width}`);

          // Rematados still leaves provisional rows: nothing painted either.
          await openFilters(page);
          await page.getByTestId("filter-finished").click();
          await expect(page).toHaveURL(/f=finished/);
          await expect(page.getByTestId("provisional-mark")).toHaveCount(0);
          await expect(legend(page)).toHaveCount(0);
        });
      }

      test(`SPEC-084 CA-2 hidden at ${width}px without JS`, async ({
        browser,
      }) => {
        const context = await browser.newContext({
          javaScriptEnabled: false,
          viewport: { width, height: 900 },
        });
        const page = await context.newPage();
        try {
          await page.goto(route.path);
          await checkHidden(page, route.dict);
          await capture(page, `oculto-nojs-${route.lang}-${width}`);
        } finally {
          await context.close();
        }
      });

      for (const javaScriptEnabled of [true, false]) {
        test(`SPEC-084 CA-3 label at ${width}px ${javaScriptEnabled ? "with" : "without"} JS: the word, no glyph, no legend`, async ({
          browser,
        }) => {
          const context = await browser.newContext({
            javaScriptEnabled,
            viewport: { width, height: 900 },
          });
          const page = await context.newPage();
          try {
            await page.goto(label);
            await checkLabel(page, route.dict);
          } finally {
            await context.close();
          }
        });
      }

      test(`SPEC-034 CA-3 mark at ${width}px with JS: glyph, legend, and the legend follows the visible rows`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(mark);
        await checkMark(page, route.dict);
        await capture(page, `provisional-${route.lang}-${width}`);

        // Rematados still leaves a provisional (Albacete–Cádiz, Saturday).
        await openFilters(page);
        await page.getByTestId("filter-finished").click();
        await expect(page).toHaveURL(/f=finished/);
        await expect(legend(page)).toBeVisible();

        // Friday's finished rows are all confirmed: no provisional left.
        await page.locator(`a[data-day-link="${FRIDAY}"]`).click();
        await expect(page).toHaveURL(new RegExp(`d=${FRIDAY}`));
        await expect(
          page.locator('li[data-qualifier="provisional"]:not([hidden])'),
        ).toHaveCount(0);
        await expect(legend(page)).toBeHidden();
        await expect(legend(page)).toBeAttached();
        await capture(page, `provisional-oculta-${route.lang}-${width}`);

        // It comes back when the change brings a provisional back.
        await page.locator(`a[data-day-link="${SATURDAY}"]`).click();
        await expect(page).toHaveURL(new RegExp(`d=${SATURDAY}`));
        await expect(legend(page)).toBeVisible();

        // Folding does not count: the folded rows are still on the screen.
        const folded = page.locator("section[data-competition]").filter({
          has: page.locator('li[data-qualifier="provisional"]:not([hidden])'),
        });
        for (const section of await folded.all()) {
          await section.getByTestId("competition-head").click();
          await expect(
            section.getByTestId("competition-details"),
          ).not.toHaveAttribute("open");
        }
        await expect(legend(page)).toBeVisible();
      });

      test(`SPEC-034 CA-3 mark at ${width}px without JS: glyph and legend served`, async ({
        browser,
      }) => {
        const context = await browser.newContext({
          javaScriptEnabled: false,
          viewport: { width, height: 900 },
        });
        const page = await context.newPage();
        try {
          await page.goto(mark);
          await checkMark(page, route.dict);
          await capture(page, `provisional-nojs-${route.lang}-${width}`);
        } finally {
          await context.close();
        }
      });
    }
  });
}

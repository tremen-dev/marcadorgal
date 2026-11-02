import { mkdirSync } from "node:fs";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { boxPort } from "../playwright.config";
import { COLORS } from "../src/design/tokens";
import { es } from "../src/i18n/es";
import { gl } from "../src/i18n/gl";

// SPEC-041 CA-6 over the demonstration, rendered per request: Bilbao
// Athletic (the longest name) scored 1 min ago at home in a live, Real
// Sporting 1 min ago away in a finished, SD Compostela 6 min ago (no mark).
// SPEC-042 CA-3: «label» is the default variant (port 3100, RECENT_GOAL_MARK
// empty); «box» is the same build served with RECENT_GOAL_MARK=box
// (playwright.config.ts).
const routes = [
  { path: "/demo/xornada", lang: "gl", dict: gl },
  { path: "/es/demo/xornada", lang: "es", dict: es },
] as const;
const VARIANTS = [
  { mark: "label", origin: "" },
  { mark: "box", origin: `http://localhost:${boxPort}` },
] as const;

const LIVE = "primera-rfef-g1-2026-27-j6-bilbao-athletic-ud-ourense";
const FINISHED = "segunda-division-2026-27-j9-real-oviedo-real-sporting";
const OLD = "segunda-rfef-g1-2026-27-j5-sd-compostela-ourense-cf";
const WIDTHS = [360, 390, 1024, 1440, 1920] as const;
// QA_CAPTURE_DIR=docs/epicas/EPIC-003-xornada-publica/_qa/SPEC-041
const CAPTURES = process.env.QA_CAPTURE_DIR;

const rgb = (value: string): string => {
  const [r, g, b] = [1, 3, 5].map((i) =>
    Number.parseInt(value.slice(i, i + 2), 16),
  );
  return `rgb(${r}, ${g}, ${b})`;
};

async function capture(page: Page, name: string, row?: Locator) {
  if (!CAPTURES) return;
  mkdirSync(CAPTURES, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  if (row) await row.screenshot({ path: `${CAPTURES}/${name}-fila.png` });
  else
    await page.screenshot({ path: `${CAPTURES}/${name}.png`, fullPage: true });
}

const row = (page: Page, id: string) =>
  page.locator(`[data-testid="match-row"][data-match-id="${id}"]`);
const marked = (page: Page) => page.locator("[data-recent-goal]");

// Which side of each row is marked, by the order of its two scores.
const sides = (page: Page, id: string) =>
  row(page, id)
    .getByTestId("score")
    .evaluateAll((els) => els.map((el) => el.hasAttribute("data-recent-goal")));

async function checkMarked(
  page: Page,
  mark: "box" | "label",
  dict: typeof gl | typeof es,
) {
  await expect(marked(page)).toHaveCount(2);
  expect(await sides(page, LIVE)).toEqual([true, false]);
  expect(await sides(page, FINISHED)).toEqual([false, true]);
  expect(await sides(page, OLD)).toEqual([false, false]);
  await expect(row(page, LIVE).getByTestId("score").first()).toHaveText("1");
  for (const score of await marked(page).all()) {
    await expect(score).toHaveCSS("animation-duration", "1s");
    await expect(score).toHaveCSS("animation-name", /recent-goal-pulse/);
    if (mark === "box")
      await expect(score).toHaveCSS(
        "background-color",
        rgb(COLORS.bgStep.value),
      );
  }
  // The words are in the accessibility tree, once per marked number.
  for (const id of [LIVE, FINISHED])
    expect(await row(page, id).ariaSnapshot()).toContain(
      dict.xornada.recentGoal,
    );
  expect(await row(page, OLD).ariaSnapshot()).not.toContain(
    dict.xornada.recentGoal,
  );
  const tags = page.getByTestId("recent-goal-tag");
  if (mark === "label") {
    await expect(tags).toHaveCount(2);
    for (const tag of await tags.all()) {
      await expect(tag).toBeVisible();
      await expect(tag).toHaveText(dict.xornada.recentGoalLabel);
      await expect(tag).toHaveAttribute("aria-hidden", "true");
      // No colour fill: a border, never a state colour.
      await expect(tag).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    }
  } else {
    await expect(tags).toHaveCount(0);
  }
}

// D-2 and the row: no name truncated, the pill and the scores inside their
// row, no horizontal scroll.
async function checkLayout(page: Page) {
  const offenders = await page
    .locator('[data-testid="team-name"]')
    .evaluateAll((els) =>
      els
        .filter((el) => {
          const style = getComputedStyle(el);
          return (
            el.scrollWidth > el.clientWidth + 1 ||
            style.textOverflow === "ellipsis"
          );
        })
        .map((el) => el.textContent),
    );
  expect(offenders).toEqual([]);
  const outside = await page
    .locator('[data-testid="recent-goal-tag"], [data-testid="score"]')
    .evaluateAll((els) =>
      els
        .filter((el) => {
          const li = el.closest("li");
          if (li === null) return true;
          const r = el.getBoundingClientRect();
          const box = li.getBoundingClientRect();
          return (
            r.left < box.left - 0.5 ||
            r.right > box.right + 0.5 ||
            r.top < box.top - 0.5 ||
            r.bottom > box.bottom + 0.5
          );
        })
        .map((el) => el.outerHTML),
    );
  expect(outside).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

for (const variant of VARIANTS) {
  for (const route of routes) {
    const url = `${variant.origin}${route.path}`;
    const name = `${variant.mark}-${route.lang}`;

    for (const width of [390, 1440]) {
      test(`CA-6 ${variant.mark} ${route.path} at ${width} px: marked, pulsing, gone after 5 min without the network`, async ({
        page,
      }) => {
        const errors: string[] = [];
        page.on("console", (m) => {
          if (m.type() === "error") errors.push(m.text());
        });
        page.on("pageerror", (e) => errors.push(e.message));
        await page.clock.install();
        await page.setViewportSize({ width, height: 900 });
        await page.goto(url);
        await checkMarked(page, variant.mark, route.dict);
        const live = row(page, LIVE);
        const before = (await live.boundingBox())?.height;
        await capture(page, `${name}-${width}`);
        await capture(page, `${name}-${width}`, live);
        const requests: string[] = [];
        page.on("request", (r) => requests.push(r.url()));
        // CA-5: 1 s before its end the mark is there; at its end, gone.
        const until = Date.parse(
          (await marked(page).first().getAttribute("data-recent-goal-until")) ??
            "",
        );
        const left = until - (await page.evaluate(() => Date.now()));
        expect(left).toBeGreaterThan(3 * 60_000);
        await page.clock.fastForward(left - 1_000);
        await expect(marked(page)).toHaveCount(2);
        await page.clock.fastForward(1_000);
        await expect(marked(page)).toHaveCount(0, { timeout: 1_000 });
        // And 5 min after the render, nothing left.
        await page.clock.fastForward(5 * 60_000 - left);
        await expect(marked(page)).toHaveCount(0);
        expect(errors.filter((e) => /hydrat/i.test(e))).toEqual([]);
        await expect(page.getByTestId("recent-goal-tag")).toHaveCount(0);
        for (const id of [LIVE, FINISHED])
          expect(await row(page, id).ariaSnapshot()).not.toContain(
            route.dict.xornada.recentGoal,
          );
        expect(requests).toEqual([]);
        // «box» does not change the row's height.
        if (variant.mark === "box")
          expect((await live.boundingBox())?.height).toBe(before);
        await capture(page, `${name}-${width}-vencido`, live);
      });
    }

    test(`CA-6 ${variant.mark} ${route.path}: reduced motion, no animation, the mark stays`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width: 390, height: 900 });
      await page.goto(url);
      await expect(marked(page)).toHaveCount(2);
      for (const score of await marked(page).all())
        await expect(score).toHaveCSS("animation-name", "none");
      if (variant.mark === "label")
        await expect(page.getByTestId("recent-goal-tag")).toHaveCount(2);
      await capture(page, `${name}-390-movimiento-reducido`, row(page, LIVE));
    });

    test(`CA-6 ${variant.mark} ${route.path}: without JS the mark is served`, async ({
      browser,
    }) => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto(url);
      await checkMarked(page, variant.mark, route.dict);
      await context.close();
    });

    test(`CA-6 ${variant.mark} ${route.path}: nothing truncated nor outside its row from 360 to 1920 px`, async ({
      page,
    }) => {
      await page.goto(url);
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        await expect(marked(page)).toHaveCount(2);
        await checkLayout(page);
      }
    });
  }
}

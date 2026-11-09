import { expect, type Locator, type Page, test } from "@playwright/test";
import { boxPort } from "../playwright.config";
import { COLORS } from "../src/design/tokens";
import { es } from "../src/i18n/es";
import { gl } from "../src/i18n/gl";

// SPEC-068: the scorers hung from their team in the row, over the
// demonstration (CA-8), at 360 and 1440 px, in gl and es.
const routes = [
  { path: "/demo/xornada", lang: "gl", dict: gl },
  { path: "/es/demo/xornada", lang: "es", dict: es },
] as const;
const WIDTHS = [360, 1440] as const;

// Betis 2–1 Deportivo: both sides, a penalty, an own goal, a long name.
const BOTH = "primera-division-2026-27-j8-real-betis-rc-deportivo";
// Bilbao Athletic 1–0 UD Ourense, live, home scored 1 min ago (SPEC-041).
const LIVE = "primera-rfef-g1-2026-27-j6-bilbao-athletic-ud-ourense";
// Sevilla 2–1 Getafe: a score, no list of goals.
const NO_GOALS = "primera-division-2026-27-j8-sevilla-fc-getafe-cf";

const rgb = (value: string): string => {
  const [r, g, b] = [1, 3, 5].map((i) =>
    Number.parseInt(value.slice(i, i + 2), 16),
  );
  return `rgb(${r}, ${g}, ${b})`;
};
const FG = rgb(COLORS.fg.value);
const FG_MUTED = rgb(COLORS.fgMuted.value);

const row = (page: Page, id: string) =>
  page.locator(`[data-testid="match-row"][data-match-id="${id}"]`);
const blocks = (r: Locator) => r.getByTestId("team-goals");

const box = async (l: Locator) => {
  const b = await l.boundingBox();
  if (b === null) throw new Error("no box");
  return b;
};

async function open(page: Page, id: string) {
  const r = row(page, id);
  await expect(r).toHaveAttribute("aria-expanded", "false");
  await r.click();
  await expect(r).toHaveAttribute("aria-expanded", "true");
  // The fold's transition is 0.25 s; wait for the track to settle.
  for (const b of await blocks(r).all())
    await expect
      .poll(() => b.evaluate((el) => getComputedStyle(el).gridTemplateRows))
      .not.toBe("0px");
  await page.waitForTimeout(400);
  return r;
}

async function ready(page: Page, url: string, width: number) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
}

for (const route of routes) {
  for (const width of WIDTHS) {
    test.describe(`${route.path} at ${width} px`, () => {
      test("CA-1: each block hangs from its team, inside .sides, without a border", async ({
        page,
      }) => {
        await ready(page, route.path, width);
        const r = await open(page, BOTH);
        const names = r.getByTestId("team-name");
        const home = await box(names.nth(0));
        const away = await box(names.nth(1));
        const homeBlock = await box(blocks(r).nth(0));
        const awayBlock = await box(blocks(r).nth(1));
        // Home block between the two names; away block under the away name.
        expect(homeBlock.y).toBeGreaterThanOrEqual(home.y + home.height - 1);
        expect(homeBlock.y + homeBlock.height).toBeLessThanOrEqual(away.y + 1);
        expect(awayBlock.y).toBeGreaterThanOrEqual(away.y + away.height - 1);
        // No border on the block nor on what it wraps.
        for (const b of await blocks(r).all()) {
          const widths = await b.evaluate((el) =>
            [el, ...el.querySelectorAll("*")].map(
              (e) => getComputedStyle(e).borderTopWidth,
            ),
          );
          expect(widths.every((w) => w === "0px")).toBe(true);
        }
        expect(await r.textContent()).not.toContain("⚽");
        await expect(r.getByTestId("match-goals")).toHaveCount(0);
      });

      test("CA-2: minute first in a fixed mono column, name whole in sans, both --fg-muted", async ({
        page,
      }) => {
        await ready(page, route.path, width);
        const r = await open(page, BOTH);
        const minutes = r.getByTestId("goal-minute");
        const players = r.getByTestId("goal-player");
        await expect(minutes).toHaveCount(3);
        await expect(minutes.nth(0)).toHaveText("23'");
        await expect(minutes.nth(1)).toHaveText("67'");
        await expect(minutes.nth(2)).toHaveText("80'");
        await expect(players.nth(1)).toHaveText(
          "Francisco José Sánchez Rodríguez de la Fuente",
        );
        const boxes = await Promise.all(
          (await minutes.all()).map((m) => box(m)),
        );
        for (const b of boxes) {
          expect(b.width).toBeCloseTo(boxes[0].width, 0);
          expect(b.x + b.width).toBeCloseTo(boxes[0].x + boxes[0].width, 0);
        }
        for (const m of await minutes.all()) {
          await expect(m).toHaveCSS("font-family", /Geist Mono/);
          await expect(m).toHaveCSS("font-variant-numeric", "tabular-nums");
          await expect(m).toHaveCSS("color", FG_MUTED);
          await expect(m).toHaveCSS("text-align", "right");
        }
        for (const p of await players.all()) {
          const family = await p.evaluate(
            (el) => getComputedStyle(el).fontFamily,
          );
          expect(family).toMatch(/^"?Geist"?,/);
          expect(family).not.toMatch(/Geist Mono/);
        }
        // The long name: whole, wrapped at 360 px, its minute on the first line.
        const longMinute = await box(minutes.nth(1));
        const longPlayer = await box(players.nth(1));
        expect(Math.abs(longMinute.y - longPlayer.y)).toBeLessThanOrEqual(1);
        const lines = Math.round(longPlayer.height / 16);
        if (width === 360) expect(lines).toBeGreaterThanOrEqual(2);
        const scroll = await players
          .nth(1)
          .evaluate((el) => el.scrollWidth > el.clientWidth + 1);
        expect(scroll).toBe(false);
        // The player who did not just score reads muted; see CA-4 for --fg.
        await expect(players.nth(0)).toHaveCSS("color", FG_MUTED);
      });

      test("CA-3: (p.) and (p.p.) in --fg-muted, upright", async ({ page }) => {
        await ready(page, route.path, width);
        const r = await open(page, BOTH);
        const kinds = r.getByTestId("goal-kind");
        await expect(kinds).toHaveCount(2);
        await expect(kinds.nth(0)).toHaveText(route.dict.xornada.goalPenalty);
        await expect(kinds.nth(1)).toHaveText(route.dict.xornada.goalOwnGoal);
        for (const k of await kinds.all()) {
          await expect(k).toHaveCSS("color", FG_MUTED);
          await expect(k).toHaveCSS("font-style", "normal");
        }
      });

      test("CA-4: the recent scorer in --fg with the pill, which stops at `until` without reloading", async ({
        page,
      }) => {
        await page.clock.install();
        await ready(page, route.path, width);
        const r = await open(page, LIVE);
        const recent = r.locator(
          '[data-testid="goal-line"][data-recent="true"]',
        );
        await expect(recent).toHaveCount(1);
        await expect(recent.getByTestId("goal-player")).toHaveText(
          "Unai Gómez",
        );
        await expect(recent.getByTestId("goal-player")).toHaveCSS("color", FG);
        const badge = recent.getByTestId("recent-scorer-badge");
        await expect(badge).toHaveText(route.dict.xornada.recentGoalLabel);
        await expect(badge).toHaveCSS("animation-name", /recent-scorer-pulse/);
        await expect(badge).toHaveCSS("animation-duration", "1s");
        const until = Date.parse(
          (await r
            .locator("[data-recent-goal-until]")
            .first()
            .getAttribute("data-recent-goal-until")) ?? "",
        );
        const now = await page.evaluate(() => Date.now());
        const iterations = Number(
          await badge.evaluate(
            (el) => getComputedStyle(el).animationIterationCount,
          ),
        );
        // pulseIterations(until, clock): one pulse per second left, read at
        // hydration, a few seconds before this `now`.
        expect(iterations).toBeGreaterThan(3 * 60);
        expect(Math.abs(iterations - (until - now) / 1000)).toBeLessThan(15);
        const requests: string[] = [];
        page.on("request", (q) => requests.push(q.url()));
        await page.clock.fastForward(until - now - 1_000);
        await expect(recent).toHaveCount(1);
        await page.clock.fastForward(1_000);
        await expect(recent).toHaveCount(0, { timeout: 1_000 });
        await expect(r.getByTestId("recent-scorer-badge")).toHaveCount(0);
        await expect(
          r.locator('[data-testid="goal-line"][data-recent="false"]'),
        ).toHaveCount(1);
        expect(requests).toEqual([]);
      });

      test("CA-5: served folded; click, Enter, Space and a click inside a block toggle every block at once", async ({
        page,
      }) => {
        await ready(page, route.path, width);
        const r = row(page, BOTH);
        await expect(r).toHaveAttribute("role", "button");
        await expect(r).toHaveAttribute("tabindex", "0");
        await expect(r).toHaveAttribute("aria-expanded", "false");
        await expect(r).toHaveAttribute("aria-label", /.+/);
        await expect(r).toHaveCSS("cursor", "pointer");
        const ids = ((await r.getAttribute("aria-controls")) ?? "").split(" ");
        expect(ids).toEqual([`goals-${BOTH}-home`, `goals-${BOTH}-away`]);
        for (const id of ids)
          await expect(page.locator(`#${id}`)).toHaveCount(1);
        const all = blocks(r);
        await expect(all).toHaveCount(2);
        for (const b of await all.all()) {
          await expect(b).toHaveAttribute("data-expanded", "false");
          expect((await box(b)).height).toBe(0);
          await expect(b).toHaveCSS("grid-template-rows", "0px");
          await expect(b).toHaveCSS(
            "transition-property",
            /grid-template-rows/,
          );
        }
        // Click opens: both at once.
        await r.click();
        await expect(r).toHaveAttribute("aria-expanded", "true");
        for (const b of await all.all()) {
          await expect(b).toHaveAttribute("data-expanded", "true");
          await expect
            .poll(async () => (await box(b)).height)
            .toBeGreaterThan(10);
        }
        // A click inside a block folds.
        await r.getByTestId("goal-line").first().click();
        await expect(r).toHaveAttribute("aria-expanded", "false");
        for (const b of await all.all())
          await expect(b).toHaveAttribute("data-expanded", "false");
        // Enter and Space.
        await r.focus();
        await page.keyboard.press("Enter");
        await expect(r).toHaveAttribute("aria-expanded", "true");
        await page.keyboard.press("Space");
        await expect(r).toHaveAttribute("aria-expanded", "false");
        // A row without goals gains nothing.
        const plain = row(page, NO_GOALS);
        await expect(plain).not.toHaveAttribute("role", /.+/);
        await expect(plain).not.toHaveAttribute("aria-expanded", /.+/);
        await expect(plain).not.toHaveAttribute("aria-controls", /.+/);
        await expect(blocks(plain)).toHaveCount(0);
        await plain.click();
        await expect(plain).not.toHaveAttribute("aria-expanded", /.+/);
      });
    });
  }
}

// CA-6: the folded row measures the same as without the blocks, in the two
// variants of RECENT_GOAL_MARK (label on the default port, box on boxPort).
for (const variant of [
  { mark: "label", origin: "" },
  { mark: "box", origin: `http://localhost:${boxPort}` },
] as const) {
  for (const width of WIDTHS) {
    test(`CA-6 ${variant.mark} at ${width} px: the folded blocks take no room`, async ({
      page,
    }) => {
      await ready(page, `${variant.origin}/demo/xornada`, width);
      const measure = (id: string) =>
        row(page, id).evaluate((li) => {
          // Layout positions (offsetTop), untouched by the transform of the
          // recent score's pulse (SPEC-041).
          const top = (el: Element) => (el as HTMLElement).offsetTop;
          const y = (sel: string) =>
            [...li.querySelectorAll(sel)].map((el) => top(el) - top(li));
          return {
            height: (li as HTMLElement).offsetHeight,
            names: y('[data-testid="team-name"]'),
            scores: y('[data-testid="score"]'),
          };
        });
      const before = { both: await measure(BOTH), live: await measure(LIVE) };
      await page.addStyleTag({
        content: '[data-testid="team-goals"] { display: none !important; }',
      });
      const after = { both: await measure(BOTH), live: await measure(LIVE) };
      expect(after).toEqual(before);
      expect(before.both.names).toHaveLength(2);
      expect(before.both.scores).toHaveLength(2);
    });
  }
}

test("CA-4: with reduced motion the pill does not animate", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page, "/demo/xornada", 360);
  const r = await open(page, LIVE);
  await expect(r.getByTestId("recent-scorer-badge")).toHaveCSS(
    "animation-name",
    "none",
  );
});

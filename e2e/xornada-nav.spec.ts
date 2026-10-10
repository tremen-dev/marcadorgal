import { mkdirSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { es } from "../src/i18n/es";
import { gl } from "../src/i18n/gl";

// SPEC-028 over the demo (Friday 2 to Monday 5 of October 2026): the sidebar
// takes you to a competition (CA-1..CA-3), the logo goes home (CA-4) and the
// title says which xornada is on screen (CA-6), at the CA-7 widths.
const routes = [
  { path: "/demo/xornada", lang: "gl", dict: gl, home: "/", range: "2–5 out" },
  {
    path: "/es/demo/xornada",
    lang: "es",
    dict: es,
    home: "/es",
    range: "2–5 oct",
  },
] as const;

const WIDTHS = [360, 390, 1024, 1440] as const;
const DESKTOP = [1024, 1440] as const;
// QA_CAPTURE_DIR=docs/epicas/EPIC-003-xornada-publica/_qa/SPEC-028
const CAPTURES = process.env.QA_CAPTURE_DIR;

async function capture(page: Page, name: string) {
  if (!CAPTURES) return;
  mkdirSync(CAPTURES, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${CAPTURES}/${name}.png` });
}

const noPageScroll = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );

// CA-1: the header is whole inside the viewport and nothing covers it.
const summaryInView = (page: Page, id: string) =>
  page.evaluate((id) => {
    const summary = document.querySelector<HTMLElement>(`#rows-${id} summary`);
    if (!summary) return { whole: false, uncovered: false };
    const r = summary.getBoundingClientRect();
    const hit = document.elementFromPoint(
      r.left + r.width / 2,
      r.top + r.height / 2,
    );
    return {
      whole: r.top >= 0 && r.bottom <= window.innerHeight,
      uncovered: hit !== null && summary.contains(hit),
    };
  }, id);

// Smooth scrolling ends; then the position is read.
const settled = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let last = -1;
        let still = 0;
        const tick = () => {
          still = window.scrollY === last ? still + 1 : 0;
          last = window.scrollY;
          if (still >= 5) resolve();
          else requestAnimationFrame(tick);
        };
        tick();
      }),
  );

const sectionIds = (page: Page): Promise<string[]> =>
  page
    .getByTestId("competition")
    .evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-competition") ?? ""),
    );

for (const route of routes) {
  test.describe(`SPEC-028 ${route.path} (${route.lang})`, () => {
    for (const width of DESKTOP) {
      test(`CA-1 at ${width}px: the entry opens, scrolls and focuses; the URL stays`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 700 });
        await page.goto(`${route.path}#f=finished`);
        await expect(page.getByTestId("filter-finished")).toHaveAttribute(
          "aria-current",
          "true",
        );
        const visible = await page
          .locator("section[data-competition]:visible")
          .evaluateAll((els) =>
            els.map((el) => el.getAttribute("data-competition") ?? ""),
          );
        const target = visible[visible.length - 1];
        // Folded by hand first: the entry opens it.
        await page.locator(`#rows-${target} summary`).click();
        await expect(page.locator(`#rows-${target}`)).not.toHaveAttribute(
          "open",
        );
        await page.evaluate(() => window.scrollTo(0, 0));
        const before = await page.evaluate(() => ({
          href: location.href,
          length: history.length,
        }));
        const entry = page.locator(`[data-competition-link="${target}"]`);
        await expect(entry).not.toHaveAttribute("aria-expanded");
        await expect(entry).not.toHaveAttribute("aria-controls");
        expect(await entry.textContent()).not.toMatch(/[▾▸]/);
        await expect(entry).toHaveAttribute("href", `#xornada-${target}`);
        await entry.click();
        await expect(page.locator(`#rows-${target}`)).toHaveAttribute(
          "open",
          "",
        );
        await settled(page);
        expect(
          await page.evaluate(
            (id) =>
              document.activeElement ===
              document.querySelector(`#rows-${id} summary`),
            target,
          ),
        ).toBe(true);
        expect(await summaryInView(page, target)).toEqual({
          whole: true,
          uncovered: true,
        });
        expect(
          await page.evaluate(() => ({
            href: location.href,
            length: history.length,
          })),
        ).toEqual(before);
        // The sidebar, sticky, next to the competition it took you to.
        await capture(page, `lateral-${route.lang}-${width}`);
        // Day and filter still applied.
        await expect(page.getByTestId("filter-finished")).toHaveAttribute(
          "aria-current",
          "true",
        );
        const statuses = await page
          .locator('[data-testid="match-row"]:visible')
          .evaluateAll((els) =>
            els.map((el) => el.getAttribute("data-status")),
          );
        expect(statuses.every((s) => s === "finished")).toBe(true);
        // Never folds: a second click leaves it open.
        await entry.click();
        await settled(page);
        await expect(page.locator(`#rows-${target}`)).toHaveAttribute(
          "open",
          "",
        );
        // Folding stays on the header (SPEC-023 CA-5).
        await page.locator(`#rows-${target} summary`).click();
        await expect(page.locator(`#rows-${target}`)).not.toHaveAttribute(
          "open",
        );
        await expect(page.getByTestId("competition").first()).toHaveCSS(
          "scroll-margin-top",
          "16px",
        );
      });

      test(`CA-1 at ${width}px: with reduced motion the jump is instant`, async ({
        page,
      }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.setViewportSize({ width, height: 700 });
        await page.goto(route.path);
        await expect(page.getByTestId("filter-all")).toHaveAttribute(
          "aria-current",
          "true",
        );
        const ids = await sectionIds(page);
        const target = ids[ids.length - 1];
        const y = await page.evaluate((id) => {
          document
            .querySelector<HTMLElement>(`[data-competition-link="${id}"]`)
            ?.click();
          return window.scrollY;
        }, target);
        expect(y).toBeGreaterThan(0);
        expect(await summaryInView(page, target)).toEqual({
          whole: true,
          uncovered: true,
        });
      });

      test(`CA-2 at ${width}px without JavaScript: the entry is an anchor to its section`, async ({
        browser,
      }) => {
        const context = await browser.newContext({
          javaScriptEnabled: false,
          viewport: { width, height: 700 },
        });
        const page = await context.newPage();
        await page.goto(route.path);
        const ids = await sectionIds(page);
        const target = ids[ids.length - 2];
        const entry = page.locator(`[data-competition-link="${target}"]`);
        await expect(entry).toHaveAttribute("href", `#xornada-${target}`);
        await entry.click();
        await expect(page).toHaveURL(new RegExp(`#xornada-${target}$`));
        expect(await summaryInView(page, target)).toEqual({
          whole: true,
          uncovered: true,
        });
        await context.close();
      });

      test(`CA-3 at ${width}px: the sidebar is sticky and goes with its sections`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 200 });
        await page.goto(route.path);
        await expect(page.getByTestId("filter-all")).toHaveAttribute(
          "aria-current",
          "true",
        );
        const sidebar = page.getByTestId("sidebar");
        await expect(sidebar).toHaveCSS("position", "sticky");
        await expect(sidebar).toHaveCSS("overflow-y", "auto");
        // Taller than the viewport: it scrolls inside itself.
        const box = await sidebar.evaluate((el) => ({
          client: el.clientHeight,
          scroll: el.scrollHeight,
          viewport: window.innerHeight,
        }));
        expect(box.client).toBeLessThanOrEqual(box.viewport);
        expect(box.scroll).toBeGreaterThan(box.client);
        const ids = await sectionIds(page);
        const last = ids[ids.length - 1];
        await page.locator(`[data-competition-link="${last}"]`).click();
        await settled(page);
        expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
        const top = await sidebar.evaluate(
          (el) => el.getBoundingClientRect().top,
        );
        expect(top).toBeGreaterThanOrEqual(0);
        expect(top).toBeLessThan(1);
        await expect(
          page.locator(`[data-competition-link="${last}"]`),
        ).toBeInViewport();

        // A day that empties a competition hides its entry; back, it shows.
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(() => window.scrollTo(0, 0));
        const check = async () => {
          const pairs = await page.evaluate(() =>
            [
              ...document.querySelectorAll<HTMLElement>(
                "section[data-competition]",
              ),
            ].map((section) => {
              const id = section.dataset.competition ?? "";
              const entry = document.querySelector<HTMLElement>(
                `[data-competition-link="${id}"]`,
              );
              return {
                id,
                section: section.hidden,
                entry: entry?.closest("li")?.hidden ?? null,
                shown: entry?.checkVisibility() ?? null,
              };
            }),
          );
          for (const p of pairs) {
            expect(p.entry, p.id).toBe(p.section);
            expect(p.shown, p.id).toBe(!p.section);
          }
          return pairs;
        };
        let emptied = false;
        for (const day of await page.getByTestId("day-link").all()) {
          await day.click();
          emptied ||= (await check()).some((p) => p.section);
          await day.click();
        }
        await page.getByTestId("filter-live").click();
        emptied ||= (await check()).some((p) => p.section);
        expect(emptied).toBe(true);
        await page.getByTestId("filter-all").click();
        expect((await check()).every((p) => !p.section)).toBe(true);
        // Down at the last competition, the sidebar is still there.
        await page.mouse.move(width - 100, 10);
        await page.locator(`[data-competition-link="${last}"]`).click();
        await settled(page);
        expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
        await expect(sidebar).toBeInViewport();
        await capture(page, `lateral-abajo-${route.lang}-${width}`);
      });
    }

    for (const width of WIDTHS) {
      test(`CA-4 and CA-6 at ${width}px: logo home and the visible title`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route.path);
        const heading = `${route.dict.xornada.heading.replace("{range}", route.range)}`;
        const h1 = page.locator("h1");
        await expect(h1).toHaveCount(1);
        await expect(h1).toBeVisible();
        await expect(h1).toHaveText(heading);
        const text = h1.locator("span");
        await expect(text).toHaveCSS("font-weight", "600");
        await expect(text).toHaveCSS("font-size", "13px");
        expect(
          await text.evaluate((el) => getComputedStyle(el).boxShadow),
        ).toMatch(/inset/);
        const logo = page.getByTestId("home-link");
        await expect(logo).toHaveAttribute("href", route.home);
        await expect(logo).toHaveAccessibleName(route.dict.xornada.home);
        await expect(logo).toHaveCSS("text-decoration-line", "none");
        await logo.hover();
        await expect(logo).toHaveCSS("text-decoration-line", "none");
        // Nothing truncated, no page scroll (D-2).
        const truncated = await page
          .locator('h1, h1 span, [data-testid="home-link"]')
          .evaluateAll(
            (els) =>
              els.filter(
                (el) =>
                  el.scrollWidth > el.clientWidth ||
                  getComputedStyle(el).textOverflow === "ellipsis",
              ).length,
          );
        expect(truncated).toBe(0);
        expect(await noPageScroll(page)).toBe(true);

        const box = async (selector: string) => {
          const b = await page.locator(selector).first().boundingBox();
          if (b === null) throw new Error(selector);
          return b;
        };
        const title = await box("h1");
        if (width >= 1024) {
          // In the 56 px header, 28 px after the logo.
          const header = await box("header");
          const logoBox = await box('[data-testid="home-link"]');
          expect(header.height).toBe(56);
          expect(title.y).toBeGreaterThanOrEqual(header.y);
          expect(title.y + title.height).toBeLessThanOrEqual(
            header.y + header.height,
          );
          expect(Math.round(title.x - (logoBox.x + logoBox.width))).toBe(28);
        } else {
          // The 42 px row between the strip and the filters.
          const strip = await box('[data-testid="day-strip"]');
          const filters = await box('[data-testid="filters"]');
          expect(title.height).toBe(42);
          expect(Math.round(title.y)).toBe(Math.round(strip.y + strip.height));
          expect(Math.round(filters.y)).toBe(
            Math.round(title.y + title.height),
          );
        }
        // The range is the week's: choosing a day or a filter keeps it.
        await page.getByTestId("day-link").nth(1).click();
        await page.getByTestId("filter-finished").click();
        await expect(h1).toHaveText(heading);
        await page.getByTestId("day-link").nth(1).click();
        await page.getByTestId("filter-all").click();
        await capture(page, `titulo-${route.lang}-${width}`);

        // Focus ring on the logo by keyboard: the first stop of the page.
        await page.goto(route.path);
        await page.keyboard.press("Tab");
        await expect(logo).toBeFocused();
        expect(
          await logo.evaluate((el) => getComputedStyle(el).outlineStyle),
        ).not.toBe("none");
      });

      test(`CA-4 at ${width}px: from a filtered, folded, scrolled demo the logo goes to ${route.home}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 700 });
        await page.goto(`${route.path}#d=2026-10-03&f=finished`);
        await expect(page.getByTestId("filter-finished")).toHaveAttribute(
          "aria-current",
          "true",
        );
        for (const head of (
          await page.locator('[data-testid="competition-head"]:visible').all()
        ).slice(0, 2))
          await head.click();
        await page.evaluate(() => window.scrollTo(0, 200));
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.getByTestId("home-link").click();
        await page.waitForURL((url) => url.pathname === route.home);
        expect(
          await page.evaluate(() => ({
            path: location.pathname,
            hash: location.hash,
            y: window.scrollY,
          })),
        ).toEqual({ path: route.home, hash: "", y: 0 });
        await expect(page.locator("html")).toHaveAttribute("lang", route.lang);
        await expect(page.getByTestId("home-link")).toHaveAttribute(
          "href",
          route.home,
        );
        await expect(page.locator("h1")).toHaveCount(1);
      });
    }

    test("CA-2 with JavaScript: a #xornada-<id> fragment is not filter state", async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(route.path);
      const ids = await sectionIds(page);
      const total = await page.getByTestId("match-row").count();
      await page.goto(`${route.path}#xornada-${ids[2]}`);
      await page.reload();
      await expect(page.getByTestId("filter-all")).toHaveAttribute(
        "aria-current",
        "true",
      );
      await expect(
        page.locator('[data-testid="day-link"][aria-current]'),
      ).toHaveCount(0);
      await expect(
        page.locator('[data-testid="match-row"]:visible'),
      ).toHaveCount(total);
      expect(errors).toEqual([]);
    });

    test("CA-6 without JavaScript: the same title and logo", async ({
      browser,
    }) => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto(route.path);
      await expect(page.locator("h1")).toHaveText(
        route.dict.xornada.heading.replace("{range}", route.range),
      );
      await expect(page.getByTestId("home-link")).toHaveAttribute(
        "href",
        route.home,
      );
      await context.close();
    });
  });
}

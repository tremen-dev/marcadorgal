import { mkdirSync, readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { boxPort } from "../playwright.config";
import { COLORS, MEASURE } from "../src/design/tokens";
import { es } from "../src/i18n/es";
import { gl } from "../src/i18n/gl";

// SPEC-081 (ADR-035): the motto «todo o fútbol galego» in Caveat by the
// wordmark: beside it on desktop (CA-3, CA-4), under it on mobile (CA-5),
// outside the link (CA-6) and with nothing moving when the font swaps (CA-7).
// QA_CAPTURE_DIR=docs/epicas/EPIC-003-xornada-publica/_qa/SPEC-081
const CAPTURES = process.env.QA_CAPTURE_DIR;
const MOTTO = gl.xornada.lema;
const LEMA = '[data-testid="xornada-lema"]';
const LOGO = '[data-testid="home-link"]';
const TITLE_ROW = '[data-testid="xornada-title-row"]';
const LOCALES = '[data-testid="locale-switch"]';

const rgb = (value: string): string => {
  const [r, g, b] = [1, 3, 5].map((i) =>
    Number.parseInt(value.slice(i, i + 2), 16),
  );
  return `rgb(${r}, ${g}, ${b})`;
};

async function capture(page: Page, name: string) {
  if (!CAPTURES) return;
  mkdirSync(CAPTURES, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${CAPTURES}/${name}.png` });
}

type Box = { x: number; y: number; width: number; height: number };

const box = (page: Page, selector: string): Promise<Box> =>
  page.locator(selector).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

const overlap = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

// The y of an element's (last line's) alphabetic baseline: a zero-size
// inline-block sits on it.
const baseline = (page: Page, selector: string): Promise<number> =>
  page.locator(selector).evaluate((el) => {
    const probe = document.createElement("span");
    probe.style.cssText =
      "display:inline-block;width:0;height:0;vertical-align:baseline";
    el.appendChild(probe);
    const y = probe.getBoundingClientRect().y;
    probe.remove();
    return y;
  });

const caveatLoaded = (page: Page): Promise<boolean> =>
  page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].some(
      (f) => f.family.replaceAll('"', "") === "Caveat" && f.status === "loaded",
    );
  });

// SPEC-072: the arrows flank the title only with a reader and no strip;
// here they are drawn the same way (the module's own weekArrow class).
const addArrows = (page: Page) =>
  page.evaluate(() => {
    const row = document.querySelector('[data-testid="xornada-title-row"]');
    const h1 = row?.querySelector("h1");
    let arrowClass = "";
    for (const sheet of [...document.styleSheets])
      for (const rule of [...sheet.cssRules])
        if (rule instanceof CSSStyleRule) {
          const m = rule.selectorText.match(/\.([\w-]*weekArrow[\w-]*)/);
          if (m && !arrowClass) arrowClass = m[1];
        }
    if (!row || !h1 || !arrowClass) throw new Error("no title row or class");
    row.setAttribute("data-arrows", "true");
    for (const [glyph, before] of [
      ["‹", true],
      ["›", false],
    ] as const) {
      const a = document.createElement("a");
      a.className = arrowClass;
      a.href = "#";
      a.textContent = glyph;
      if (before) row.insertBefore(a, h1);
      else row.appendChild(a);
    }
  });

const pages = [
  { path: "/", dict: gl },
  { path: "/es", dict: es },
  { path: "/demo/xornada", dict: gl },
  { path: "/es/demo/xornada", dict: es },
] as const;

test.describe("SPEC-081 CA-3 desktop: beside the wordmark, on its baseline", () => {
  for (const { path } of pages)
    for (const width of [1024, 1440])
      test(`${path} at ${width} px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        expect(await caveatLoaded(page)).toBe(true);
        const lema = page.locator(LEMA);
        await expect(lema).toHaveText(MOTTO);
        await expect(lema).toBeVisible();
        const style = await lema.evaluate((el) => {
          const s = getComputedStyle(el);
          return {
            fontSize: s.fontSize,
            family: s.fontFamily.split(",")[0].replaceAll('"', "").trim(),
            weight: s.fontWeight,
            color: s.color,
            opacity: s.opacity,
          };
        });
        expect(style).toEqual({
          fontSize: "19px",
          family: "Caveat",
          weight: "400",
          color: rgb(COLORS.fg.value),
          opacity: "0.72",
        });
        const logoSize = await page
          .locator(LOGO)
          .evaluate((el) => getComputedStyle(el).fontSize);
        expect(logoSize).toBe("21px");
        const logo = await box(page, LOGO);
        const motto = await box(page, LEMA);
        expect(motto.x).toBeGreaterThan(logo.x + logo.width);
        expect(motto.x - (logo.x + logo.width)).toBeGreaterThanOrEqual(8);
        expect(motto.x - (logo.x + logo.width)).toBeLessThanOrEqual(12);
        expect(
          Math.abs((await baseline(page, LEMA)) - (await baseline(page, LOGO))),
        ).toBeLessThanOrEqual(1);
        await capture(page, `ca3-${path.replaceAll("/", "_") || "_"}-${width}`);
      });
});

test.describe("SPEC-081 CA-4 desktop: the motto never pushes", () => {
  const routes = [
    { path: "/demo/xornada", lang: "gl" },
    { path: "/es/demo/xornada", lang: "es" },
  ] as const;
  for (const { path, lang } of routes)
    for (const width of [1024, 1100, 1280, 1440])
      for (const arrows of [false, true])
        test(`${lang} at ${width} px ${arrows ? "with" : "without"} arrows`, async ({
          page,
        }) => {
          await page.setViewportSize({ width, height: 900 });
          await page.goto(`http://localhost:${boxPort}${path}`);
          await page.evaluate(() => document.fonts.ready);
          if (arrows) await addArrows(page);
          await expect(page.locator(LEMA)).toBeVisible();
          const rects = {
            logo: await box(page, LOGO),
            lema: await box(page, LEMA),
            title: await box(page, TITLE_ROW),
            locales: await box(page, LOCALES),
          };
          const names = Object.keys(rects) as (keyof typeof rects)[];
          for (const a of names)
            for (const b of names)
              if (a < b)
                expect(overlap(rects[a], rects[b]), `${a}/${b}`).toBe(false);
          const title = await page.locator("h1").evaluate((h1) => {
            // The text's own line boxes, not the boxes of its elements.
            const text = h1.querySelector("span")?.firstChild;
            if (!text) throw new Error("no title text");
            const range = document.createRange();
            range.selectNodeContents(text);
            const tops = new Set(
              [...range.getClientRects()].map((r) => Math.round(r.top)),
            );
            return {
              lines: tops.size,
              fits: h1.scrollWidth <= h1.clientWidth,
            };
          });
          expect(title).toEqual({ lines: 1, fits: true });
          expect(rects.locales.x + rects.locales.width).toBeLessThanOrEqual(
            width,
          );
          if (arrows) await capture(page, `ca4-${lang}-${width}-flechas`);
        });

  for (const width of [1024, 1440])
    test(`a 200-character title at ${width} px: the motto goes whole first`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`http://localhost:${boxPort}/demo/xornada`);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator(LEMA)).toBeVisible();
      await page.locator("h1 span").evaluate((span) => {
        span.textContent = `Xornada · ${"moi longa ".repeat(20)}`.slice(0, 200);
      });
      expect(
        await page.locator("h1 span").evaluate((s) => s.textContent?.length),
      ).toBe(200);
      const display = await page
        .locator(LEMA)
        .evaluate((el) => getComputedStyle(el).display);
      expect(display).toBe("none");
      // Out of the accessibility tree, not cut half-way.
      await expect(page.getByText(MOTTO, { exact: true })).toBeHidden();
      // The wordmark stays whole and clear of the title.
      const logo = await box(page, LOGO);
      const title = await box(page, TITLE_ROW);
      expect(logo.width).toBeGreaterThan(120);
      expect(overlap(logo, title)).toBe(false);
      await capture(page, `ca4-titulo-200-${width}`);
    });

  test("CSS only: without JavaScript the motto is there and gives way the same", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 1024, height: 900 },
    });
    const page = await context.newPage();
    await page.goto(`http://localhost:${boxPort}/demo/xornada`);
    await expect(page.locator(LEMA)).toBeVisible();
    await page.locator("h1 span").evaluate((span) => {
      span.textContent = `Xornada · ${"moi longa ".repeat(20)}`.slice(0, 200);
    });
    await expect(page.locator(LEMA)).toBeHidden();
    // The rule is a container query on the motto's own box.
    const css = readFileSync(
      "src/components/xornada/Xornada.module.css",
      "utf8",
    );
    expect(css).toMatch(
      /@container \(width < 124px\)\s*\{\s*\.lema\s*\{\s*display: none;/,
    );
    await context.close();
  });
});

test.describe("SPEC-081 CA-5 mobile: under the wordmark, the bar still 52 px", () => {
  const cases = [
    { path: "/", port: 0, strip: false },
    { path: "/es", port: 0, strip: false },
    { path: "/demo/xornada", port: 0, strip: true },
    { path: "/es/demo/xornada", port: 0, strip: true },
    { path: "/demo/xornada", port: boxPort, strip: false },
    { path: "/es/demo/xornada", port: boxPort, strip: false },
  ] as const;
  for (const { path, port, strip } of cases)
    for (const width of [360, 768])
      test(`${path} at ${width} px, ${strip ? "with" : "without"} strip`, async ({
        page,
      }) => {
        expect(MEASURE.barMobileHeader).toBe(52);
        await page.setViewportSize({ width, height: 800 });
        await page.goto(port ? `http://localhost:${port}${path}` : path);
        await page.evaluate(() => document.fonts.ready);
        await expect(page.getByTestId("day-strip")).toHaveCount(strip ? 1 : 0);
        const lema = page.locator(LEMA);
        await expect(lema).toBeVisible();
        expect(await lema.evaluate((el) => getComputedStyle(el).fontSize)).toBe(
          "16px",
        );
        const bar = await box(page, "header");
        expect(bar.height).toBe(52);
        expect(
          await page.evaluate(() =>
            getComputedStyle(document.documentElement)
              .getPropertyValue("--bar-mobile-header")
              .trim(),
          ),
        ).toBe("52px");
        const logo = await box(page, LOGO);
        const motto = await box(page, LEMA);
        const locales = await box(page, LOCALES);
        expect(motto.y).toBeGreaterThanOrEqual(logo.y + logo.height);
        expect(Math.abs(motto.x - logo.x)).toBeLessThanOrEqual(0.5);
        for (const r of [logo, motto]) {
          expect(r.y).toBeGreaterThanOrEqual(bar.y + 2);
          expect(r.y + r.height).toBeLessThanOrEqual(bar.y + bar.height - 2);
        }
        expect(overlap(logo, motto)).toBe(false);
        expect(overlap(logo, locales)).toBe(false);
        expect(overlap(motto, locales)).toBe(false);
        // Below the header nothing moves: the same tops without the motto.
        const below = [
          TITLE_ROW,
          '[data-testid="day-strip"]',
          '[data-testid="filters"]',
          "main",
        ];
        const tops = () =>
          page.evaluate(
            (selectors) =>
              selectors.map(
                (s) =>
                  document.querySelector(s)?.getBoundingClientRect().y ?? -1,
              ),
            below,
          );
        const withMotto = await tops();
        await page.addStyleTag({
          content: `${LEMA} { display: none !important; }`,
        });
        const withoutMotto = await tops();
        for (const [i, y] of withMotto.entries()) {
          expect(Math.abs(y - withoutMotto[i]), below[i]).toBeLessThanOrEqual(
            0.5,
          );
        }
        await page.addStyleTag({
          content: `${LEMA} { display: block !important; }`,
        });
        await capture(
          page,
          `ca5-${path.replaceAll("/", "_")}-${width}-${strip ? "tira" : "sen-tira"}`,
        );
      });
});

test.describe("SPEC-081 CA-6 accessibility: plain Galician text beside the link", () => {
  for (const { path, dict } of pages)
    test(`${path}`, async ({ page }) => {
      await page.goto(path);
      const home = page.getByTestId("home-link");
      await expect(home).toHaveAccessibleName(dict.xornada.home);
      const lema = page.locator(LEMA);
      await expect(lema).toHaveAttribute("lang", "gl");
      const where = await lema.evaluate((el) => ({
        inLink: el.closest("a") !== null,
        inHeading: el.closest("h1,h2,h3,h4,h5,h6,[role=heading]") !== null,
        role: el.getAttribute("role"),
        tag: el.tagName,
        sharesParentWithLink:
          el.closest("header")?.querySelector('[data-testid="home-link"]')
            ?.parentElement === el.parentElement?.parentElement,
      }));
      expect(where).toEqual({
        inLink: false,
        inHeading: false,
        role: null,
        tag: "SPAN",
        sharesParentWithLink: true,
      });
      await expect(page.getByText(MOTTO, { exact: true })).toBeVisible();
    });
});

test.describe("SPEC-081 CA-7 no layout shift when Caveat arrives late", () => {
  for (const width of [360, 1440])
    test(`/ at ${width} px with the woff2 2 s late`, async ({ page }) => {
      await page.route("**/fonts/Caveat-Regular.woff2", async (route) => {
        await new Promise((r) => setTimeout(r, 2000));
        await route.continue();
      });
      await page.addInitScript(() => {
        (window as unknown as { __shifts: unknown[] }).__shifts = [];
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const sources =
              (entry as unknown as { sources?: { node?: Node }[] }).sources ??
              [];
            (window as unknown as { __shifts: unknown[] }).__shifts.push(
              sources.map(
                (s) =>
                  !!s.node &&
                  !!(
                    s.node instanceof Element ? s.node : s.node.parentElement
                  )?.closest("header"),
              ),
            );
          }
        }).observe({ type: "layout-shift", buffered: true });
      });
      await page.setViewportSize({ width, height: 900 });
      const response = await page.goto("/", { waitUntil: "domcontentloaded" });
      const html = (await response?.text()) ?? "";
      expect(html).not.toMatch(
        /rel="preload"[^>]*Caveat|Caveat[^>]*rel="preload"/,
      );
      // Geist settled, Caveat still on its way: only its swap is measured.
      await page.waitForFunction(() =>
        [...document.fonts]
          .filter((f) => !f.family.includes("Caveat"))
          .every((f) => f.status !== "loading"),
      );
      expect(
        await page.evaluate(() => document.fonts.check("19px Caveat")),
      ).toBe(false);
      await page.evaluate(() => {
        (window as unknown as { __shifts: unknown[] }).__shifts = [];
      });
      const rects = () =>
        Promise.all([LOGO, LEMA, TITLE_ROW, LOCALES].map((s) => box(page, s)));
      const before = await rects();
      await capture(page, `ca7-antes-${width}`);
      expect(await caveatLoaded(page)).toBe(true);
      const after = await rects();
      await capture(page, `ca7-despois-${width}`);
      before.forEach((r, i) => {
        for (const k of ["x", "y", "width", "height"] as const)
          expect(Math.abs(r[k] - after[i][k]), `${i}.${k}`).toBeLessThanOrEqual(
            0.5,
          );
      });
      const shifts = await page.evaluate(
        () => (window as unknown as { __shifts: boolean[][] }).__shifts,
      );
      expect(shifts.flat().filter(Boolean)).toEqual([]);
    });
});

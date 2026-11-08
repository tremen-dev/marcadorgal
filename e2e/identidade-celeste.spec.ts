import { mkdirSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { explorerAppPort } from "../playwright.config";
import { COLORS } from "../src/design/tokens";
import { es } from "../src/i18n/es";
import { gl } from "../src/i18n/gl";

// SPEC-065 (ADR-029): the sky blue brand on screen, the drawn block of the
// wordmark and the victory green of the form guide.
const WIDTHS = [360, 1440] as const;
const GLYPH = String.fromCodePoint(0x25ae);
const CAPTURES = process.env.QA_CAPTURE_DIR;

const rgb = (value: string): string => {
  const [r, g, b] = [1, 3, 5].map((i) =>
    Number.parseInt(value.slice(i, i + 2), 16),
  );
  return `rgb(${r}, ${g}, ${b})`;
};
const BRAND = rgb(COLORS.brand.value);
const BRAND_DEEP = rgb(COLORS.brandDeep.value);
const BRAND_INK = rgb(COLORS.brandInk.value);

async function capture(page: Page, name: string) {
  if (!CAPTURES) return;
  mkdirSync(CAPTURES, { recursive: true });
  await page.screenshot({ path: `${CAPTURES}/${name}.png` });
}

type Block = {
  width: number;
  height: number;
  fontSize: number;
  radius: number;
  background: string;
  text: string;
};

const blockIn = (page: Page, link: string): Promise<Block> =>
  page.locator(link).evaluate((a) => {
    const span = a.querySelector('span[aria-hidden="true"]');
    if (!span) throw new Error("no block");
    const s = getComputedStyle(span);
    const box = span.getBoundingClientRect();
    return {
      width: box.width,
      height: box.height,
      fontSize: Number.parseFloat(s.fontSize),
      radius: Number.parseFloat(s.borderTopLeftRadius),
      background: s.backgroundColor,
      text: span.textContent ?? "",
    };
  });

const expectBlock = (b: Block, where: string) => {
  expect(b.text, where).toBe("");
  expect(b.width / b.fontSize, where).toBeGreaterThanOrEqual(0.28);
  expect(b.width / b.fontSize, where).toBeLessThanOrEqual(0.32);
  expect(b.height / b.fontSize, where).toBeGreaterThanOrEqual(0.7);
  expect(b.height / b.fontSize, where).toBeLessThanOrEqual(0.74);
  expect(b.radius / b.fontSize, where).toBeGreaterThanOrEqual(0.085);
  expect(b.radius / b.fontSize, where).toBeLessThanOrEqual(0.105);
  expect(b.background, where).toBe("rgb(0, 153, 204)");
};

const pages = [
  { path: "/", dict: gl },
  { path: "/es", dict: es },
  { path: "/demo/xornada", dict: gl },
  { path: "/es/demo/xornada", dict: es },
] as const;

test.describe("SPEC-065 CA-3 the wordmark with a drawn block", () => {
  for (const { path, dict } of pages)
    for (const width of WIDTHS)
      test(`${path} at ${width} px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        const home = page.getByTestId("home-link");
        await expect(home).toHaveAccessibleName(dict.xornada.home);
        await expect(home).toHaveText("marcadorgal");
        await expect(home).toHaveCSS("font-weight", "800");
        const fontSize = Number.parseFloat(
          await home.evaluate((el) => getComputedStyle(el).fontSize),
        );
        await expect(home).toHaveCSS(
          "letter-spacing",
          `${Math.round(-0.045 * fontSize * 1000) / 1000}px`,
        );
        expectBlock(await blockIn(page, '[data-testid="home-link"]'), "header");

        const footerLink = page
          .getByTestId("app-footer")
          .getByRole("link", { name: dict.common.title, exact: true });
        await expect(footerLink).toHaveCount(1);
        await expect(footerLink).toHaveText("marcadorgal");
        expectBlock(
          await blockIn(
            page,
            `[data-testid="app-footer"] a[aria-label="${dict.common.title}"]`,
          ),
          "footer",
        );

        const text = await page.evaluate(() => document.body.textContent ?? "");
        expect(text).not.toContain(GLYPH);
        await capture(page, `ca3-${path.replaceAll("/", "_") || "_"}-${width}`);
      });
});

const demos = [
  { path: "/demo/xornada", dict: gl },
  { path: "/es/demo/xornada", dict: es },
] as const;

test.describe("SPEC-065 CA-6 the screen in sky blue", () => {
  for (const { path } of demos)
    for (const width of WIDTHS)
      test(`${path} at ${width} px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        // The selected day: brand fill, ink text.
        const day = page.getByTestId("day-link").first();
        await day.click();
        await expect(day).toHaveAttribute("aria-current", "true");
        await expect(day).toHaveCSS("background-color", BRAND);
        await expect(day).toHaveCSS("color", BRAND_INK);
        await day.click();
        await expect(day).not.toHaveAttribute("aria-current", "true");

        // The Equipo galego: brand; losing (Deportivo–Betis), the deep one.
        const names = await page.getByTestId("team-name").evaluateAll((els) =>
          els.map((el) => ({
            text: el.textContent ?? "",
            galician: el.hasAttribute("data-galician"),
            color: getComputedStyle(el).color,
          })),
        );
        const marked = names.filter((n) => n.galician);
        expect(marked.length).toBeGreaterThan(10);
        for (const n of marked) expect([BRAND, BRAND_DEEP]).toContain(n.color);
        expect(marked.some((n) => n.color === BRAND)).toBe(true);
        expect(names.find((n) => n.text === "Deportivo")?.color).toBe(
          BRAND_DEEP,
        );

        // Live stays in ember.
        const live = page.locator('[data-status="live"]').first();
        await expect(live).toBeVisible();
        const ember = rgb(COLORS.ember.value);
        const liveColors = await live.evaluate((row) =>
          [...row.querySelectorAll("*")].map(
            (el) => getComputedStyle(el).color,
          ),
        );
        expect(liveColors).toContain(ember);
        expect(liveColors).not.toContain("rgb(0, 153, 204)");
        await capture(page, `ca6-${path.replaceAll("/", "_")}-${width}`);
      });

  // The active competition tab (CompetitionNav): brand fill, ink text.
  for (const path of ["/directos", "/es/directos"])
    for (const width of WIDTHS)
      test(`${path} active competition tab at ${width} px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        const tab = page.getByTestId("tab-all");
        await expect(tab).toHaveAttribute("aria-selected", "true");
        await expect(tab).toHaveCSS("background-color", BRAND);
        await expect(tab).toHaveCSS("color", BRAND_INK);
        await capture(page, `ca6-${path.replaceAll("/", "_")}-${width}`);
      });
});

test.describe("SPEC-065 CA-7 victory in the form guide", () => {
  for (const prefix of ["", "/es"])
    for (const width of WIDTHS)
      test(`${prefix}/clasificacion at ${width} px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(
          `http://localhost:${explorerAppPort}${prefix}/clasificacion/primera-rfef-g1`,
        );
        const cells = await page.locator("table td span").evaluateAll((els) =>
          els
            .filter((el) => /^[WVDELP]$/.test(el.textContent ?? ""))
            .map((el) => {
              const s = getComputedStyle(el);
              return {
                letter: el.textContent ?? "",
                background: s.backgroundColor,
                color: s.color,
              };
            }),
        );
        expect(cells.map((c) => c.letter)).toEqual([
          "W",
          "D",
          "L",
          "W",
          "W",
          "L",
          "V",
          "E",
          "D",
          "W",
        ]);
        for (const c of cells.filter(
          (x) => x.letter === "W" || x.letter === "V",
        ))
          expect(c).toMatchObject({
            background: "rgb(76, 195, 138)",
            color: "rgb(17, 17, 16)",
          });
        // Draw and loss keep their colours (the form guide's spec).
        for (const c of cells.filter(
          (x) => x.letter === "D" || x.letter === "E",
        ))
          expect(c).toMatchObject({
            background: rgb(COLORS.amber.value),
            color: rgb(COLORS.bg.value),
          });
        for (const c of cells.filter((x) => x.letter === "L"))
          expect(c).toMatchObject({
            background: rgb(COLORS.fgDim.value),
            color: rgb(COLORS.fg.value),
          });
        await capture(page, `ca7${prefix.replace("/", "_")}-${width}`);
      });
});

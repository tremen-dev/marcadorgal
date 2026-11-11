import { expect, type Page, test } from "@playwright/test";
import { explorerAppPort } from "../playwright.config";
import { es } from "../src/i18n/es";
import { gl } from "../src/i18n/gl";
import { GALICIAN_CLUBS } from "../src/model/clubs";
import { openFilters } from "./filters-panel";

// SPEC-057: the home without CompetitionNav, the table link behind
// SHOW_TABLE_LINK (off on this server), the panel of visible leagues and its
// resilience (no JS, blocked storage). Over the demo: five men's leagues.
const routes = [
  { home: "/", demo: "/demo/xornada", lang: "gl", dict: gl },
  { home: "/es", demo: "/es/demo/xornada", lang: "es", dict: es },
] as const;

const DEMO_LEAGUES = [
  "primera-division",
  "segunda-division",
  "primera-rfef-g1",
  "segunda-rfef-g1",
  "tercera-rfef-g1",
];

const visibleLeagues = (page: Page): Promise<string[]> =>
  page
    .locator("section[data-competition]")
    .evaluateAll((sections) =>
      sections
        .filter((s) => (s as HTMLElement).checkVisibility())
        .map((s) => s.getAttribute("data-competition") ?? ""),
    );

// Every access to window.localStorage throws, as with storage blocked.
const blockStorage = () => {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("The operation is insecure.", "SecurityError");
    },
  });
};

for (const route of routes) {
  test.describe(`SPEC-057 (${route.lang})`, () => {
    test("CA-1 no CompetitionNav on the home: the header comes first", async ({
      page,
    }) => {
      for (const path of [route.home, route.demo]) {
        await page.goto(path);
        await expect(page.getByTestId("competition-nav")).toHaveCount(0);
        await expect(page.getByTestId("home-link")).toBeVisible();
        const first = await page.evaluate(() => {
          const header = document.querySelector('[data-testid="home-link"]');
          const top = header?.getBoundingClientRect().top ?? -1;
          // Nothing visible with text sits above the logo.
          const above = [...document.body.querySelectorAll("a, button, nav")]
            .filter((el) => (el as HTMLElement).checkVisibility())
            .filter((el) => el.getBoundingClientRect().bottom <= top);
          return above.length;
        });
        expect(first).toBe(0);
      }
    });

    test("CA-1 CompetitionNav stays on /directos and /competicion", async ({
      page,
    }) => {
      const prefix = route.lang === "es" ? "/es" : "";
      await page.goto(`${prefix}/directos`);
      await expect(page.getByTestId("competition-nav")).toBeVisible();
      for (const kind of ["competicion", "clasificacion", "calendario"]) {
        await page.goto(
          `http://localhost:${explorerAppPort}${prefix}/${kind}/primera-rfef-g1`,
        );
        await expect(page.getByTestId("competition-nav")).toBeVisible();
      }
    });

    test("CA-2 off by default: no column links to /competicion/", async ({
      page,
    }) => {
      await page.goto(route.demo);
      await expect(page.getByTestId("competition")).toHaveCount(5);
      await expect(page.getByTestId("competition-table-link")).toHaveCount(0);
      await expect(page.locator('main a[href*="/competicion/"]')).toHaveCount(
        0,
      );
    });

    test("CA-3 switches named in the page's language, presets and the last league", async ({
      page,
    }) => {
      await page.goto(route.demo);
      await openFilters(page);
      await page.getByTestId("leagues-preferences-trigger").click();
      const dialog = page.getByTestId("leagues-preferences-dialog");
      await expect(dialog).toHaveAttribute("role", "dialog");
      await expect(dialog).toHaveAttribute("aria-modal", "true");

      const names = route.dict.competitions.names;
      for (const [id, name] of Object.entries(names)) {
        await expect(
          dialog
            .locator("li")
            .filter({ has: page.getByTestId(`toggle-competition-${id}`) }),
        ).toContainText(name);
      }
      // SPEC-083 CA-1 (amends SPEC-057 CA-3): a switch names its league
      // only, never a team.
      const switches = await dialog.locator("li").allInnerTexts();
      expect(switches).toHaveLength(Object.keys(names).length);
      const teams = Object.values(GALICIAN_CLUBS).flatMap((club) => [
        club.name,
        club.shortName,
      ]);
      for (const text of switches)
        for (const team of teams) expect(text).not.toContain(team);
      await expect(dialog).not.toContainText("Depor ABANCA");
      await expect(dialog).not.toContainText("As Celtas");
      if (route.lang === "es") {
        await expect(dialog).toContainText("Primera División");
        await expect(dialog).not.toContainText("Primeira División");
      }

      const toolbar = dialog.getByRole("toolbar");
      await expect(toolbar).toHaveAttribute(
        "aria-label",
        route.dict.competitions.presetsLabel,
      );
      const c = route.dict.competitions;
      await expect(page.getByTestId("preset-all")).toHaveText(c.presetAll);
      await expect(page.getByTestId("preset-women")).toHaveText(c.presetWomen);
      await expect(page.getByTestId("preset-modest")).toHaveText(
        c.presetModest,
      );
      await expect(page.getByTestId("preset-pro")).toHaveText(c.presetPro);

      await page.getByTestId("preset-pro").click();
      expect(await visibleLeagues(page)).toEqual([
        "primera-division",
        "segunda-division",
      ]);
      await page.getByTestId("preset-modest").click();
      expect(await visibleLeagues(page)).toEqual([
        "primera-rfef-g1",
        "segunda-rfef-g1",
        "tercera-rfef-g1",
      ]);
      await page.getByTestId("preset-women").click();
      expect(await visibleLeagues(page)).toEqual([]);
      await page.getByTestId("preset-all").click();
      expect(await visibleLeagues(page)).toEqual(DEMO_LEAGUES);

      // The last league selected cannot be unchecked.
      await page.getByTestId("preset-pro").click();
      await page.getByTestId("toggle-competition-segunda-division").click();
      const last = page.getByTestId("toggle-competition-primera-division");
      await expect(last).toBeChecked();
      await expect(last).toBeDisabled();
      await expect(dialog).toContainText(c.atLeastOne);
      expect(await visibleLeagues(page)).toEqual(["primera-division"]);

      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
    });

    test("CA-3 a switch reached with Tab shows a focus ring", async ({
      page,
    }) => {
      await page.goto(route.demo);
      await openFilters(page);
      await page.getByTestId("leagues-preferences-trigger").click();
      await expect(
        page.getByTestId("leagues-preferences-dialog"),
      ).toBeVisible();

      let onSwitch = false;
      for (let i = 0; i < 20 && !onSwitch; i++) {
        await page.keyboard.press("Tab");
        onSwitch = await page.evaluate(
          () =>
            document.activeElement
              ?.getAttribute("data-testid")
              ?.startsWith("toggle-competition-") ?? false,
        );
      }
      expect(onSwitch).toBe(true);

      const ring = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const s = getComputedStyle(el);
        return {
          outline: s.outlineStyle !== "none" && s.outlineWidth !== "0px",
          shadow: s.boxShadow !== "none",
        };
      });
      expect(ring.outline || ring.shadow).toBe(true);
    });

    test("CA-5 without JavaScript every league is served", async ({
      browser,
    }) => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const noJs = await context.newPage();
      await noJs.goto(route.demo);
      expect(await visibleLeagues(noJs)).toEqual(DEMO_LEAGUES);
      await context.close();
    });

    test("CA-5 with storage blocked the home loads whole and the panel works in memory", async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(blockStorage);
      await page.goto(route.demo);
      await expect(page.getByTestId("competition")).toHaveCount(5);
      expect(await visibleLeagues(page)).toEqual(DEMO_LEAGUES);
      await openFilters(page);
      await page.getByTestId("leagues-preferences-trigger").click();
      await page.getByTestId("preset-pro").click();
      expect(await visibleLeagues(page)).toEqual([
        "primera-division",
        "segunda-division",
      ]);
      await page.getByTestId("toggle-competition-tercera-rfef-g1").click();
      expect(await visibleLeagues(page)).toEqual([
        "primera-division",
        "segunda-division",
        "tercera-rfef-g1",
      ]);
      expect(errors).toEqual([]);

      await page.goto(route.home);
      await expect(page.getByTestId("home-link")).toBeVisible();
      expect(errors).toEqual([]);
    });
  });
}

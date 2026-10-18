import { mkdirSync } from "node:fs";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { weekOf } from "../src/board/weeks";
import { COLORS } from "../src/design/tokens";
import { es } from "../src/i18n/es";
import { gl } from "../src/i18n/gl";
import { DEMO_MATCHES } from "../src/xornada/demo";
import { madridDate } from "../src/xornada/view";

// SPEC-033 over the demonstration (Friday 2 to Monday 5 of October 2026;
// «now» is Saturday 3): chronological rows, the header of each day, the
// Equipo galego mark and the icons.
const routes = [
  { path: "/demo/xornada", lang: "gl", dict: gl },
  { path: "/es/demo/xornada", lang: "es", dict: es },
] as const;

const TODAY = "2026-10-03";
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const;
const CAPTURES = process.env.QA_CAPTURE_DIR;

const rgb = (value: string): string => {
  const [r, g, b] = [1, 3, 5].map((i) =>
    Number.parseInt(value.slice(i, i + 2), 16),
  );
  return `rgb(${r}, ${g}, ${b})`;
};
const BRAND = rgb(COLORS.brand.value);
const BRAND_DEEP = rgb(COLORS.brandDeep.value);

// What the screen must show, computed from the data, not from the view.
function expected(dict: typeof gl | typeof es) {
  const byCompetition = new Map<string, (typeof DEMO_MATCHES)[number][]>();
  for (const m of DEMO_MATCHES) {
    const list = byCompetition.get(m.competitionId) ?? [];
    list.push(m);
    byCompetition.set(m.competitionId, list);
  }
  const header = (date: string): string => {
    const [y, mo, d] = date.split("-").map(Number);
    const weekday = WEEKDAYS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
    const label = `${dict.weekday[weekday]} ${d} ${dict.month[MONTHS[mo - 1]]}`;
    return date === TODAY ? label.toLocaleUpperCase() : label;
  };
  return new Map(
    [...byCompetition].map(([id, list]) => {
      const sorted = [...list].sort(
        (a, b) =>
          a.kickoff.localeCompare(b.kickoff) ||
          a.matchId.localeCompare(b.matchId),
      );
      const days = [...new Set(sorted.map((m) => madridDate(m.kickoff)))];
      return [
        id,
        {
          ids: sorted.map((m) => m.matchId),
          headers: days.map(header),
          days,
        },
      ];
    }),
  );
}

type Seen = {
  ids: string[];
  headers: { text: string; level: string; visible: boolean }[];
  // Each row's day group starts with its header.
  groupsOk: boolean;
};

const screen = (page: Page): Promise<Record<string, Seen>> =>
  page.locator("section[data-competition]").evaluateAll((sections) =>
    Object.fromEntries(
      sections.map((s) => {
        const groups = [...s.querySelectorAll("[data-day-group]")];
        return [
          s.getAttribute("data-competition") ?? "",
          {
            ids: [...s.querySelectorAll("li[data-match-id]")].map(
              (r) => r.getAttribute("data-match-id") ?? "",
            ),
            headers: [...s.querySelectorAll('[data-testid="day-header"]')].map(
              (h) => ({
                text: h.textContent ?? "",
                level: h.tagName,
                visible: (h as HTMLElement).checkVisibility(),
              }),
            ),
            groupsOk: groups.every(
              (g) =>
                g.firstElementChild?.getAttribute("data-testid") ===
                  "day-header" &&
                [...g.querySelectorAll("li[data-day]")].every(
                  (li) =>
                    li.getAttribute("data-day") ===
                    g.getAttribute("data-day-group"),
                ),
            ),
          },
        ];
      }),
    ),
  );

const noPageScroll = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );

const truncated = (page: Page) =>
  page
    .locator(
      '[data-testid="team-name"], [data-testid="competition-name"], [data-testid="day-header"]',
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

async function capture(page: Page, name: string) {
  if (!CAPTURES) return;
  mkdirSync(CAPTURES, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${CAPTURES}/${name}.png`, fullPage: true });
}

async function noJsPage(browser: Browser, width: number) {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width, height: 900 },
  });
  return { context, page: await context.newPage() };
}

for (const route of routes) {
  const want = expected(route.dict);

  test.describe(`SPEC-033 ${route.path} (${route.lang})`, () => {
    for (const width of [360, 390, 1024, 1440]) {
      for (const js of [true, false]) {
        test(`CA-1/CA-2/CA-5/CA-7 at ${width}px ${js ? "with" : "without"} JS: kickoff order, day headers, galician mark`, async ({
          page: jsPage,
          browser,
        }) => {
          const { context, page } = js
            ? { context: null, page: jsPage }
            : await noJsPage(browser, width);
          await page.setViewportSize({ width, height: 900 });
          await page.goto(route.path);
          const seen = await screen(page);
          expect(Object.keys(seen)).toHaveLength(5);
          for (const [id, w] of want) {
            // CA-1: by kickoff (then matchId), whatever the state.
            expect(seen[id].ids, id).toEqual(w.ids);
            // CA-2: one <h3> per day, before its first match, also with
            // a single day; today in capitals.
            expect(
              seen[id].headers.map((h) => h.text),
              id,
            ).toEqual(w.headers);
            expect(seen[id].headers.every((h) => h.level === "H3")).toBe(true);
            expect(seen[id].headers.every((h) => h.visible)).toBe(true);
            expect(seen[id].groupsOk, id).toBe(true);
          }
          // CA-2: an accessible heading, below the competition's <h2>.
          const primera = page.locator(
            'section[data-competition="primera-division"]',
          );
          await expect(primera.getByRole("heading", { level: 2 })).toHaveCount(
            1,
          );
          await expect(primera.getByRole("heading", { level: 3 })).toHaveCount(
            want.get("primera-division")?.headers.length ?? 0,
          );
          const header = page.getByTestId("day-header").first();
          await expect(header).toHaveCSS("color", rgb(COLORS.fgMuted.value));
          await expect(header).toHaveCSS("font-size", "11px");
          await expect(header).toHaveCSS("font-weight", "600");
          await expect(header).toHaveCSS("min-height", "30px");
          await expect(header).toHaveCSS(
            "background-color",
            "rgba(0, 0, 0, 0)",
          );

          // CA-5: the Equipo galego in 600 and --marca; losing or
          // postponed, --marca-deep. Nobody else is green.
          const names = await page.getByTestId("team-name").evaluateAll((els) =>
            els.map((el) => {
              const row = el.closest("li");
              const s = getComputedStyle(el);
              return {
                text: el.textContent ?? "",
                galician: el.hasAttribute("data-galician"),
                status: row?.getAttribute("data-status") ?? "",
                competition:
                  el.closest("section")?.getAttribute("data-competition") ?? "",
                weight: s.fontWeight,
                color: s.color,
              };
            }),
          );
          const marked = names.filter((n) => n.galician);
          expect(marked.length).toBeGreaterThan(10);
          for (const n of marked) {
            expect(n.weight, n.text).toBe("600");
            expect([BRAND, BRAND_DEEP], n.text).toContain(n.color);
          }
          for (const n of names.filter((x) => !x.galician))
            expect([BRAND, BRAND_DEEP], n.text).not.toContain(n.color);
          // Primeira: Deportivo loses to Betis.
          const deportivo = names.find((n) => n.text === "Deportivo");
          expect(deportivo).toMatchObject({
            galician: true,
            status: "finished",
            color: BRAND_DEEP,
          });
          expect(names.find((n) => n.text === "Betis")).toMatchObject({
            galician: false,
            weight: "600",
            color: rgb(COLORS.fg.value),
          });
          expect(names.find((n) => n.text === "Celta")?.color).toBe(BRAND);
          // A galician in a postponed match.
          expect(
            names.find((n) => n.text === "Coruxo" && n.status === "postponed")
              ?.color,
          ).toBe(BRAND_DEEP);
          // Terceira: both sides of every row (H-4).
          const tercera = names.filter(
            (n) => n.competition === "tercera-rfef-g1",
          );
          expect(tercera.length).toBeGreaterThan(0);
          expect(tercera.every((n) => n.galician)).toBe(true);

          // D-2: nothing is truncated, no horizontal scroll.
          expect(await truncated(page)).toEqual([]);
          expect(await noPageScroll(page)).toBe(true);
          await capture(
            page,
            `lectura-${route.lang}-${width}-${js ? "js" : "nojs"}`,
          );
          await context?.close();
        });
      }
    }

    for (const width of [390, 1440]) {
      test(`CA-3 at ${width}px: a chosen day hides the headers; a filter hides an emptied day`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route.path);
        const visibleHeaders = () =>
          page
            .getByTestId("day-header")
            .evaluateAll((els) =>
              els
                .filter((el) => (el as HTMLElement).checkVisibility())
                .map((el) => el.textContent ?? ""),
            );
        const all = (await visibleHeaders()).length;
        expect(all).toBeGreaterThan(5);

        // A day of the strip: the strip says it, so no header (H-1).
        await page.getByTestId("day-link").nth(1).click();
        await expect(page).toHaveURL(/#d=2026-10-03$/);
        expect(await visibleHeaders()).toEqual([]);
        await expect(
          page.locator("[data-day-header][hidden]").first(),
        ).toBeAttached();
        await capture(page, `lectura-dia-${route.lang}-${width}`);
        await page.getByTestId("day-link").nth(1).click();
        expect(await visibleHeaders()).toHaveLength(all);

        // En xogo: only days with a live match keep their group and header.
        await page.getByTestId("filter-live").click();
        await expect(page).toHaveURL(/#f=live$/);
        const groups = await page.getByTestId("day-group").evaluateAll((els) =>
          els.map((g) => ({
            visible: (g as HTMLElement).checkVisibility(),
            header:
              (
                g.querySelector('[data-testid="day-header"]') as HTMLElement
              )?.checkVisibility() ?? false,
            live: [...g.querySelectorAll("li[data-status]")].some(
              (li) => li.getAttribute("data-status") === "live",
            ),
          })),
        );
        expect(groups.some((g) => !g.live)).toBe(true);
        for (const g of groups) {
          expect(g.visible).toBe(g.live);
          expect(g.header).toBe(g.live);
        }
        await capture(page, `lectura-en-xogo-${route.lang}-${width}`);
        await page.getByTestId("filter-all").click();
        expect(await visibleHeaders()).toHaveLength(all);
      });
    }

    test("CA-3 without JS: every header shows, also after following a day link", async ({
      browser,
    }) => {
      const { context, page } = await noJsPage(browser, 390);
      await page.goto(route.path);
      const count = await page.getByTestId("day-header").count();
      expect(count).toBeGreaterThan(5);
      await page.getByTestId("day-link").nth(1).click();
      for (const header of await page.getByTestId("day-header").all())
        await expect(header).toBeVisible();
      await context.close();
    });
  });
}

// CA-6: the icons in the <head> of every page, served as images of the said
// sizes; no request for an icon ends in 404.
// A week key of the season of now, whatever the date of the run.
const thisWeek = weekOf(new Date().toISOString());
const ICON_PAGES = [
  "/",
  "/es",
  "/demo/xornada",
  "/es/demo/xornada",
  `/xornada/${thisWeek}`,
  `/es/xornada/${thisWeek}`,
];

test.describe("SPEC-033 CA-6 favicon and icons", () => {
  for (const path of ICON_PAGES) {
    test(`${path}: favicon.ico, 32 px icon and apple-touch-icon`, async ({
      page,
      request,
    }) => {
      const missing: string[] = [];
      page.on("response", (r) => {
        if (/icon|\.ico/.test(r.url()) && r.status() === 404)
          missing.push(r.url());
      });
      await page.goto(path);
      const links = await page
        .locator('head link[rel="icon"], head link[rel="apple-touch-icon"]')
        .evaluateAll((els) =>
          els.map((el) => ({
            rel: el.getAttribute("rel") ?? "",
            href: el.getAttribute("href") ?? "",
            sizes: el.getAttribute("sizes") ?? "",
          })),
        );
      expect(links).toEqual(
        expect.arrayContaining([
          { rel: "icon", href: "/favicon.ico", sizes: "16x16 32x32" },
          { rel: "icon", href: "/icon-32.png", sizes: "32x32" },
          {
            rel: "apple-touch-icon",
            href: "/apple-touch-icon.png",
            sizes: "180x180",
          },
        ]),
      );
      for (const link of links) {
        const r = await request.get(link.href);
        expect(r.status(), link.href).toBe(200);
        expect(r.headers()["content-type"], link.href).toMatch(/^image\//);
        const sizes = await page.evaluate(async (href) => {
          const blob = await (await fetch(href)).blob();
          const bitmap = await createImageBitmap(blob);
          return [bitmap.width, bitmap.height];
        }, link.href);
        // Each declared size is a square; a .ico decodes as one of its
        // images (both are checked in src/design/icon.test.ts).
        const declared = link.sizes
          .split(" ")
          .map((s) => Number(s.split("x")[0]));
        expect(declared, link.href).toContain(sizes[0]);
        expect(sizes[1], link.href).toBe(sizes[0]);
      }
      const ico = await request.get("/favicon.ico");
      expect(ico.status()).toBe(200);
      await page.waitForLoadState("networkidle");
      expect(missing).toEqual([]);
    });
  }

  test("captures at 16, 32 and 180 px", async ({ page, baseURL }) => {
    test.skip(!CAPTURES, "only when capturing");
    const files: [string, number][] = [
      ["favicon.ico", 16],
      ["icon-32.png", 32],
      ["apple-touch-icon.png", 180],
    ];
    for (const [file, size] of files) {
      await page.setViewportSize({ width: size, height: size });
      await page.setContent(
        `<body style="margin:0"><img src="${baseURL}/${file}" width="${size}" height="${size}" style="display:block"></body>`,
      );
      await page.waitForLoadState("networkidle");
      await capture(page, `icono-${size}`);
    }
  });
});

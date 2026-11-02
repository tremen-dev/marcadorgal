import { mkdirSync } from "node:fs";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { weekOf } from "../src/board/weeks";
import { COLORS } from "../src/design/tokens";
import { es } from "../src/i18n/es";
import { gl } from "../src/i18n/gl";
import { DEMO_MATCHES } from "../src/xornada/demo";
import { madridDate } from "../src/xornada/view";

// SPEC-033 over the demonstration (Friday 2 to Monday 5 of October 2026;
// «now» is Saturday 3): chronological rows, the Equipo galego mark and the
// icons. SPEC-040 CA-2/CA-3 rewrite its CA-2/CA-3: no day header; every row
// that is not live says the date of its kickoff.
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
      return [
        id,
        {
          ids: sorted.map((m) => m.matchId),
          // SPEC-040 CA-2: the date, or "" for a live row (no date).
          dates: sorted.map((m) =>
            m.status === "live" ? null : header(madridDate(m.kickoff)),
          ),
        },
      ];
    }),
  );
}

type Seen = {
  ids: string[];
  // The second line of each row's margin: its date, or the part when live.
  subs: string[];
  statuses: string[];
  headers: number;
  lists: number;
};

const screen = (page: Page): Promise<Record<string, Seen>> =>
  page.locator("section[data-competition]").evaluateAll((sections) =>
    Object.fromEntries(
      sections.map((s) => {
        const rows = [...s.querySelectorAll("li[data-match-id]")];
        return [
          s.getAttribute("data-competition") ?? "",
          {
            ids: rows.map((r) => r.getAttribute("data-match-id") ?? ""),
            subs: rows.map(
              (r) =>
                r.querySelector('[data-testid="match-margin-sub"]')
                  ?.textContent ?? "",
            ),
            statuses: rows.map((r) => r.getAttribute("data-status") ?? ""),
            headers: s.querySelectorAll(
              '[data-testid="day-header"], [data-day-group], h3',
            ).length,
            lists: s.querySelectorAll("ul").length,
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
      '[data-testid="team-name"], [data-testid="competition-name"], [data-testid="match-margin"], [data-testid="match-margin-sub"]',
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
        test(`CA-1/CA-5/CA-7, SPEC-040 CA-2 at ${width}px ${js ? "with" : "without"} JS: kickoff order, a date per row, galician mark`, async ({
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
            // SPEC-040 CA-2: no day header and one list; every row not
            // live says its date (today in capitals), no live row does.
            expect(seen[id].headers, id).toBe(0);
            expect(seen[id].lists, id).toBe(1);
            seen[id].statuses.forEach((status, i) => {
              const date = w.dates[i];
              if (date === null) {
                expect(status, id).toBe("live");
                expect(seen[id].subs[i], id).not.toMatch(/^\S+ \d+ \S+$/);
              } else {
                expect(seen[id].subs[i], id).toBe(date);
              }
            });
          }
          const primera = page.locator(
            'section[data-competition="primera-division"]',
          );
          await expect(primera.getByRole("heading", { level: 2 })).toHaveCount(
            1,
          );
          await expect(primera.getByRole("heading", { level: 3 })).toHaveCount(
            0,
          );
          // Mono 500 10 px, leading 1.2, --fg-dim.
          const date = page
            .locator('[data-status="finished"]')
            .getByTestId("match-margin-sub")
            .first();
          await expect(date).toHaveCSS("color", rgb(COLORS.fgDim.value));
          await expect(date).toHaveCSS("font-size", "10px");
          await expect(date).toHaveCSS("font-weight", "500");
          await expect(date).toHaveCSS("line-height", "12px");

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

    // SPEC-040 CA-3 (replaces SPEC-033 CA-3): no header to hide; a day
    // and a filter hide rows and the competitions they leave empty.
    for (const width of [390, 1440]) {
      test(`SPEC-040 CA-3 at ${width}px: a day and a filter hide rows and emptied competitions, no headers`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route.path);
        const state = () =>
          page.getByTestId("competition").evaluateAll((els) =>
            els.map((el) => {
              const rows = [
                ...el.querySelectorAll<HTMLElement>("li[data-day]"),
              ];
              const visible = rows.filter((r) => r.checkVisibility());
              return {
                shown: (el as HTMLElement).checkVisibility(),
                days: [...new Set(visible.map((r) => r.dataset.day))],
                statuses: [...new Set(visible.map((r) => r.dataset.status))],
                any: rows.length,
              };
            }),
          );
        await expect(
          page.locator("[data-day-header], [data-day-group]"),
        ).toHaveCount(0);
        expect((await state()).every((c) => c.shown)).toBe(true);

        await page.getByTestId("day-link").nth(0).click();
        await expect(page).toHaveURL(/#d=2026-10-02$/);
        let seen = await state();
        expect(seen.some((c) => !c.shown)).toBe(true);
        for (const c of seen) {
          expect(c.shown).toBe(c.days.length > 0);
          expect(c.days.every((d) => d === "2026-10-02")).toBe(true);
        }
        await capture(page, `lectura-dia-${route.lang}-${width}`);
        await page.getByTestId("day-link").nth(0).click();
        expect((await state()).every((c) => c.shown)).toBe(true);

        await page.getByTestId("filter-live").click();
        await expect(page).toHaveURL(/#f=live$/);
        seen = await state();
        for (const c of seen) {
          expect(c.shown).toBe(c.statuses.length > 0);
          expect(c.statuses.every((st) => st === "live")).toBe(true);
        }
        await capture(page, `lectura-en-xogo-${route.lang}-${width}`);
        await page.getByTestId("filter-all").click();
        expect((await state()).every((c) => c.shown)).toBe(true);
      });
    }

    test("SPEC-040 CA-3 without JS: every row and its date, also after following a day link", async ({
      browser,
    }) => {
      const { context, page } = await noJsPage(browser, 390);
      await page.goto(route.path);
      const total = await page.getByTestId("match-row").count();
      await expect(page.locator("[data-day-header]")).toHaveCount(0);
      await page.getByTestId("day-link").nth(1).click();
      await expect(
        page.locator('[data-testid="match-row"]:visible'),
      ).toHaveCount(total);
      for (const sub of await page
        .locator('[data-testid="match-row"]:not([data-status="live"])')
        .getByTestId("match-margin-sub")
        .all())
        await expect(sub).toHaveText(/\d/);
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

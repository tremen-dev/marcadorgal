import { mkdirSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { es } from "../src/i18n/es";
import { gl } from "../src/i18n/gl";

// SPEC-024 with the switch off (CI): / and /es keep themselves up to date by
// polling /api/board, simulated here with page.route; the browser clock is
// Playwright's (page.clock). No reader in CI: the page is served unavailable
// and the first 200 fills it (CA-4).

const CAPTURES = process.env.QA_CAPTURE_DIR;
const NOW = Date.parse("2026-10-10T17:00:00.000Z");
const MIN = 60_000;
// 30 s ± 20 %: past the latest first request.
const POLL = 37_000;

type Match = Record<string, unknown>;

function match(
  id: string,
  competition: "primera-division" | "segunda-division",
  version: number,
  extra: Match = {},
): Match {
  return {
    matchId: id,
    competitionId: competition,
    competitionName:
      competition === "primera-division"
        ? "Primera División"
        : "Segunda División",
    tier: competition === "primera-division" ? 1 : 2,
    round: 9,
    kickoff: "2026-10-10T16:00:00.000Z",
    home: { name: `Local ${id}`, shortName: null },
    away: { name: `Visitante ${id}`, shortName: null },
    status: "live",
    score: { home: 1, away: 0 },
    minute: 50,
    addedMinute: null,
    halfTime: false,
    qualifier: "confirmado",
    version,
    observedAt: new Date(NOW - 30_000).toISOString(),
    decidedAt: new Date(NOW - 25_000).toISOString(),
    ...extra,
  };
}

const finished = (m: Match, version: number): Match => {
  const { addedMinute, halfTime, ...rest } = m;
  void addedMinute;
  void halfTime;
  return { ...rest, status: "finished", minute: null, version };
};

const LIST = [
  match("a1", "primera-division", 2),
  match("a2", "primera-division", 3, {
    // CA-9: a live row whose last observation is 5 min old.
    observedAt: new Date(NOW - 5 * MIN).toISOString(),
  }),
  finished(match("a3", "primera-division", 1), 4),
  match("b1", "segunda-division", 1),
];

type Board = { requests: (string | null)[] };

// Serves the replies in order (the last one forever) and records the
// If-None-Match of every request.
async function routeBoard(
  page: Page,
  replies: (
    | { status: 200; etag: string; matches: Match[] }
    | { status: 304; etag: string }
    | "abort"
  )[],
): Promise<Board> {
  const board: Board = { requests: [] };
  await page.route("**/api/board", async (route) => {
    board.requests.push(route.request().headers()["if-none-match"] ?? null);
    const reply = replies.length > 1 ? replies.shift() : replies[0];
    if (reply === undefined || reply === "abort") return route.abort();
    if (reply.status === 304)
      return route.fulfill({ status: 304, headers: { ETag: reply.etag } });
    return route.fulfill({
      status: 200,
      headers: { ETag: reply.etag, "Content-Type": "application/json" },
      body: JSON.stringify({ matches: reply.matches }),
    });
  });
  return board;
}

// The transport loads after the first paint; the fake clock only moves its
// timers once it has started.
const started = (page: Page) =>
  expect(page.getByTestId("freshness")).not.toHaveAttribute(
    "data-transport",
    "served",
  );

async function watch(page: Page) {
  const sockets: string[] = [];
  const scripts: Promise<string>[] = [];
  const errors: string[] = [];
  page.on("websocket", (ws) => sockets.push(ws.url()));
  page.on("response", (r) => {
    if (/\.js(\?|$)/.test(r.url())) scripts.push(r.text().catch(() => ""));
  });
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return {
    sockets,
    errors,
    supabaseLoaded: async () =>
      (await Promise.all(scripts)).some((s) =>
        /RealtimeClient|@supabase|phoenix/.test(s),
      ),
  };
}

const visibleIds = (page: Page): Promise<string[]> =>
  page
    .getByTestId("match-row")
    .evaluateAll((rows) =>
      rows
        .filter((row) => (row as HTMLElement).checkVisibility())
        .map((row) => row.getAttribute("data-match-id") ?? ""),
    );

for (const route of [
  { path: "/", lang: "gl", dict: gl },
  { path: "/es", lang: "es", dict: es },
] as const) {
  test.describe(`SPEC-024 ${route.path} (${route.lang}), switch off`, () => {
    test("CA-10/CA-7: polls with If-None-Match, no socket, no supabase-js, no notice, nothing stored", async ({
      page,
    }) => {
      const seen = await watch(page);
      const board = await routeBoard(page, [
        { status: 200, etag: '"one"', matches: LIST },
        { status: 304, etag: '"one"' },
      ]);
      await page.clock.install({ time: NOW });
      await page.goto(route.path);
      await started(page);
      // CA-8: before any response, the instant of the render.
      await expect(page.getByTestId("freshness-age")).toHaveText(
        /^Actualizado (ás|a las) \d\d:\d\d$/,
      );
      await page.clock.runFor(POLL);
      await expect(page.getByTestId("match-row")).toHaveCount(LIST.length);
      // CA-4: the first 200 replaces «not available».
      await expect(page.getByTestId("xornada-unavailable")).toHaveCount(0);
      await expect(page.getByTestId("freshness-age")).toHaveText(
        route.dict.freshness.now,
      );
      await page.clock.runFor(POLL);
      await expect.poll(() => board.requests.length).toBe(2);
      // The page was served unavailable: no ETag to send the first time.
      expect(board.requests).toEqual([null, '"one"']);
      await page.clock.runFor(2 * MIN);
      await expect(page.getByTestId("freshness-age")).toHaveText(
        route.dict.freshness.now,
      );
      // H-6: polling is the normal mode, nothing is announced.
      await expect(page.getByTestId("freshness-notice")).toHaveText("");
      await expect(page.getByTestId("freshness")).toHaveAttribute(
        "data-transport",
        "polling",
      );
      expect(seen.sockets).toEqual([]);
      expect(await seen.supabaseLoaded()).toBe(false);
      // CA-6 (ADR-014 §7): nothing of whoever watches.
      expect(
        await page.evaluate(() => ({
          cookie: document.cookie,
          local: localStorage.length,
          session: sessionStorage.length,
        })),
      ).toEqual({ cookie: "", local: 0, session: 0 });
      expect(seen.errors.filter((e) => /hydrat/i.test(e))).toEqual([]);
    });

    test("CA-7/D-9: a failed request says «Sen conexión» and the rows do not change", async ({
      page,
    }) => {
      await routeBoard(page, [
        { status: 200, etag: '"one"', matches: LIST },
        "abort",
      ]);
      await page.clock.install({ time: NOW });
      await page.goto(route.path);
      await started(page);
      await page.clock.runFor(POLL);
      await expect(page.getByTestId("match-row")).toHaveCount(LIST.length);
      const before = await page
        .getByTestId("match-row")
        .evaluateAll((rows) => rows.map((r) => r.outerHTML));
      await page.clock.runFor(20 * MIN);
      await expect(page.getByTestId("freshness-notice")).toHaveText(
        route.dict.freshness.offline,
      );
      await expect(page.getByTestId("freshness-notice")).toHaveAttribute(
        "role",
        "status",
      );
      // The last good response is ~20 min old (browser clock).
      await expect(page.getByTestId("freshness-age")).toHaveText(
        new RegExp(`^${route.dict.freshness.ago.replace("{n}", "(19|20)")}$`),
      );
      const after = await page
        .getByTestId("match-row")
        .evaluateAll((rows) => rows.map((r) => r.outerHTML));
      // Only the age of a1, a2 (source clock) may have moved; status,
      // qualifier and score are the same.
      const strip = (html: string[]) =>
        html.map((h) =>
          h.replace(/<span[^>]*data-testid="row-age"[^>]*>[^<]*<\/span>/, ""),
        );
      expect(strip(after)).toEqual(strip(before));
    });

    test("CA-5: with a folded competition and #f=live, a finished match leaves the view; fold and fragment stay", async ({
      page,
    }) => {
      const a1Finished = finished(match("a1", "primera-division", 2), 5);
      await routeBoard(page, [
        { status: 200, etag: '"one"', matches: LIST },
        {
          status: 200,
          etag: '"two"',
          matches: [a1Finished, ...LIST.slice(1)],
        },
      ]);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.clock.install({ time: NOW });
      await page.goto(`${route.path}#f=live`);
      await started(page);
      await page.clock.runFor(POLL);
      await expect(page.getByTestId("match-row")).toHaveCount(LIST.length);
      await expect.poll(() => visibleIds(page)).toEqual(["a1", "a2", "b1"]);
      await expect(page.locator('[data-count="live"]')).toHaveText("3");
      // Fold Segunda from its header (SPEC-028: the sidebar no longer folds).
      await page.locator("#rows-segunda-division summary").click();
      await expect(page.locator("#rows-segunda-division")).not.toHaveAttribute(
        "open",
      );
      await page.clock.runFor(POLL);
      await expect.poll(() => visibleIds(page)).toEqual(["a2"]);
      await expect(page.locator('[data-count="live"]')).toHaveText("2");
      await expect(page.locator('[data-count="finished"]')).toHaveText("2");
      await expect(
        page
          .locator(
            '[data-competition-count="primera-division"][data-show="live"]',
          )
          .first(),
      ).toContainText("1");
      await expect(page.locator("#rows-segunda-division")).not.toHaveAttribute(
        "open",
      );
      expect(new URL(page.url()).hash).toBe("#f=live");
    });

    // SPEC-028 CA-6: the visible title follows the days the client paints.
    test("SPEC-028 CA-6: the title follows the repainted days", async ({
      page,
    }) => {
      // A scheduled match on Sunday: no score, no minute, no live-only keys.
      const { addedMinute, halfTime, ...base } = match(
        "c1",
        "segunda-division",
        1,
        { kickoff: "2026-10-11T16:00:00.000Z" },
      );
      void addedMinute;
      void halfTime;
      const sunday = {
        ...base,
        status: "scheduled",
        score: null,
        minute: null,
      };
      await routeBoard(page, [
        { status: 200, etag: '"one"', matches: LIST },
        { status: 200, etag: '"two"', matches: [...LIST, sunday] },
      ]);
      await page.clock.install({ time: NOW });
      await page.goto(route.path);
      const h1 = page.locator("h1");
      // Served unavailable (no reader in CI): the title alone.
      await expect(h1).toHaveText(route.dict.xornada.title);
      await started(page);
      await page.clock.runFor(POLL);
      const month = route.dict.month.oct;
      await expect(h1).toHaveText(
        route.dict.xornada.heading.replace("{range}", `10 ${month}`),
      );
      await page.clock.runFor(POLL);
      await expect(h1).toHaveText(
        route.dict.xornada.heading.replace("{range}", `10–11 ${month}`),
      );
      await expect(h1).toHaveCount(1);
    });

    for (const width of [360, 390, 1024, 1440]) {
      test(`CA-9 at ${width} px: «${route.dict.freshness.lastData}» only on the stale live row, whole, no horizontal scroll`, async ({
        page,
      }) => {
        await routeBoard(page, [{ status: 200, etag: '"one"', matches: LIST }]);
        await page.setViewportSize({ width, height: 900 });
        await page.clock.install({ time: NOW });
        await page.goto(route.path);
        await started(page);
        await page.clock.runFor(POLL);
        await expect(page.getByTestId("match-row")).toHaveCount(LIST.length);
        const ages = page.getByTestId("row-age");
        await expect(ages).toHaveCount(1);
        const row = page.locator('[data-match-id="a2"]');
        await expect(row.getByTestId("row-age")).toHaveText(
          route.dict.freshness.lastData.replace("{n}", "5"),
        );
        // Recalculated every 30 s without the network.
        await page.unroute("**/api/board");
        await page.route("**/api/board", (r) => r.abort());
        await page.clock.runFor(2 * MIN);
        await expect(row.getByTestId("row-age")).toHaveText(
          route.dict.freshness.lastData.replace("{n}", "7"),
        );
        // a1 and b1 are now 2.5 min old too; a3 (finished) never.
        await expect(ages).toHaveCount(3);
        await expect(
          page.locator('[data-match-id="a3"]').getByTestId("row-age"),
        ).toHaveCount(0);
        expect(
          await ages.evaluateAll((els) =>
            els.every((el) => el.scrollWidth <= el.clientWidth),
          ),
        ).toBe(true);
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth,
          ),
        ).toBe(true);
        if (CAPTURES && (width === 390 || width === 1440)) {
          mkdirSync(CAPTURES, { recursive: true });
          await page.screenshot({
            path: `${CAPTURES}/fila-edad-${route.lang}-${width}.png`,
          });
        }
      });
    }
  });
}

test("CA-8: served without JS, the line says the instant of the render", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByTestId("freshness-age")).toHaveText(
    /^Actualizado ás \d\d:\d\d$/,
  );
  await expect(page.getByTestId("freshness-notice")).toHaveText("");
  await context.close();
});

test("CA-10: the demos neither subscribe nor poll", async ({ page }) => {
  const seen = await watch(page);
  const board = await routeBoard(page, [{ status: 304, etag: '"x"' }]);
  await page.clock.install({ time: NOW });
  for (const path of ["/demo/xornada", "/es/demo/xornada"]) {
    await page.goto(path);
    await expect(page.getByTestId("match-row").first()).toBeVisible();
    await page.clock.runFor(3 * MIN);
  }
  expect(board.requests).toEqual([]);
  expect(seen.sockets).toEqual([]);
  await expect(page.getByTestId("freshness")).toHaveCount(0);
});

// SPEC-025 CA-3 (H-2): the probe reads which Decision each row shows.
test("SPEC-025 CA-3: each row carries data-version, and a new Decision repaints it", async ({
  page,
}) => {
  const a1Goal = match("a1", "primera-division", 6, {
    score: { home: 2, away: 0 },
  });
  await routeBoard(page, [
    { status: 200, etag: '"one"', matches: LIST },
    { status: 200, etag: '"two"', matches: [a1Goal, ...LIST.slice(1)] },
  ]);
  await page.clock.install({ time: NOW });
  await page.goto("/");
  await started(page);
  await page.clock.runFor(POLL);
  const row = page.locator('[data-testid="match-row"][data-match-id="a1"]');
  await expect(row).toHaveAttribute("data-version", "2");
  await expect(
    page.locator('[data-testid="match-row"][data-match-id="a3"]'),
  ).toHaveAttribute("data-version", "4");
  await page.clock.runFor(POLL);
  await expect(row).toHaveAttribute("data-version", "6");
  await expect(row.getByTestId("score").first()).toHaveText("2");
});

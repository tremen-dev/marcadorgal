import { mkdirSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";
import { LOCAL_DATABASE_URL } from "../playwright.db.config";
import { currentXornada, seasonOf } from "../src/board/current";
import type { XornadaIndexEntry } from "../src/board/row";
import { es } from "../src/i18n/es";
import { gl } from "../src/i18n/gl";

// SPEC-024 CA-10 with the switch on (e2e:db builds with NEXT_PUBLIC_REALTIME
// =on against the local Realtime and its key). board_delta is enabled here
// and disabled at the end; the teardown resets the local database anyway.
// The matches used are scheduled ones of the current xornada that the seed
// leaves without Decision, so the other e2e:db cases keep their state.

const CAPTURES = process.env.QA_CAPTURE_DIR;
const sql = postgres(LOCAL_DATABASE_URL, { ssl: false, max: 1 });
let free: string[] = [];

test.beforeAll(async () => {
  const now = new Date().toISOString();
  const rows = await sql`select match_id, competition_id, season, round,
    kickoff, status, version from web.xornada where season = ${seasonOf(now)}`;
  const index = rows.map((r) => ({
    matchId: r.match_id,
    competitionId: r.competition_id,
    season: r.season,
    round: r.round,
    kickoff: r.kickoff.toISOString(),
    status: r.status,
  })) as XornadaIndexEntry[];
  const unseeded = new Set(
    rows.filter((r) => r.version === 0).map((r) => r.match_id),
  );
  free = currentXornada(index, now)
    .filter((e) => unseeded.has(e.matchId))
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
    .map((e) => e.matchId);
  expect(free.length).toBeGreaterThan(3);
  await sql`alter table public.decisions enable trigger board_delta`;
});

test.afterAll(async () => {
  await sql`alter table public.decisions disable trigger board_delta`;
  await sql.end();
});

async function decide(
  matchId: string,
  state: {
    status: "live" | "finished";
    home: number;
    away: number;
    minute: number | null;
  },
): Promise<void> {
  const values = {
    status: state.status,
    home_score: state.home,
    away_score: state.away,
    minute: state.minute,
  };
  await sql.begin(async (tx) => {
    const [{ id }] = await tx`insert into observations ${tx({
      match_id: matchId,
      source_id: "e2e-realtime",
      observed_at: new Date().toISOString(),
      raw_ref: "e2e/realtime.json",
      ...values,
    })} returning id`;
    await tx`insert into decisions ${tx({
      match_id: matchId,
      qualifier: "confirmado",
      rule: "operator",
      observation_ids: [id],
      ...values,
    })}`;
  });
}

async function watch(page: Page) {
  const errors: string[] = [];
  const board: (string | null)[] = [];
  const done: number[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/board")
      board.push(r.headers()["if-none-match"] ?? null);
  });
  page.on("requestfinished", (r) => {
    if (new URL(r.url()).pathname === "/api/board") done.push(Date.now());
  });
  page.on("requestfailed", (r) => {
    if (new URL(r.url()).pathname === "/api/board") done.push(Date.now());
  });
  return { errors, board, done };
}

const row = (page: Page, id: string) =>
  page.locator(`[data-testid="match-row"][data-match-id="${id}"]`);

const scores = (page: Page, id: string) =>
  row(page, id)
    .getByTestId("score")
    .evaluateAll((els) => els.map((el) => el.textContent));

const transport = (page: Page) =>
  page.getByTestId("freshness").getAttribute("data-transport");

let goal = 0;

for (const route of [
  { path: "/", lang: "gl", dict: gl },
  { path: "/es", lang: "es", dict: es },
] as const) {
  for (const width of [390, 1440]) {
    test(`CA-10 on ${route.path} at ${width} px: a Decision repaints its row in < 5 s without reloading`, async ({
      page,
    }) => {
      const seen = await watch(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route.path);
      await expect
        .poll(() => transport(page), { timeout: 15_000 })
        .toBe("realtime");
      await expect(page.getByTestId("freshness-notice")).toHaveText("");
      // The catch-up request of SUBSCRIBED is over before the Decision, so
      // the repaint can only come from the delta.
      await expect.poll(() => seen.board.length).toBe(1);
      await expect.poll(() => seen.done.length).toBe(1);
      const id = free[0];
      goal += 1;
      const navigations: string[] = [];
      page.on("framenavigated", (f) => navigations.push(f.url()));
      const t0 = Date.now();
      await decide(id, { status: "live", home: goal, away: 0, minute: 10 });
      await expect(row(page, id)).toHaveAttribute("data-status", "live", {
        timeout: 5_000,
      });
      await expect
        .poll(() => scores(page, id), { timeout: 5_000 })
        .toEqual([String(goal), "0"]);
      expect(Date.now() - t0).toBeLessThan(5_000);
      expect(navigations).toEqual([]);
      expect(seen.board).toHaveLength(1);
      await expect(page.getByTestId("freshness-age")).toHaveText(
        route.dict.freshness.now,
      );
      // CA-6 (ADR-014 §7): supabase-js without session leaves nothing.
      expect(
        await page.evaluate(() => ({
          cookie: document.cookie,
          local: localStorage.length,
          session: sessionStorage.length,
        })),
      ).toEqual({ cookie: "", local: 0, session: 0 });
      // CA-4: no hydration error.
      expect(seen.errors.filter((e) => /hydrat/i.test(e))).toEqual([]);
      if (CAPTURES) {
        mkdirSync(CAPTURES, { recursive: true });
        await page.screenshot({
          path: `${CAPTURES}/realtime-${route.lang}-${width}.png`,
        });
      }
    });
  }
}

test("CA-10 on: with the socket closed, the notice and requests to /api/board with If-None-Match", async ({
  page,
}) => {
  const seen = await watch(page);
  await page.routeWebSocket(/\/realtime\/v1\//, (ws) => ws.close());
  await page.goto("/");
  await expect(page.getByTestId("freshness-notice")).toHaveText(
    gl.freshness.polling,
    { timeout: 15_000 },
  );
  await expect
    .poll(() => seen.board.filter((h) => h !== null).length, {
      timeout: 15_000,
    })
    .toBeGreaterThan(0);
  expect(await transport(page)).toBe("polling");
});

test("CA-10 on: with /api/board aborted, the rows do not change", async ({
  page,
}) => {
  await page.routeWebSocket(/\/realtime\/v1\//, (ws) => ws.close());
  await page.route("**/api/board", (r) => r.abort());
  await page.goto("/es");
  const strip = (html: string[]) =>
    html.map((h) =>
      h.replace(/<span[^>]*data-testid="row-age"[^>]*>[^<]*<\/span>/, ""),
    );
  const before = strip(
    await page
      .getByTestId("match-row")
      .evaluateAll((rows) => rows.map((r) => r.outerHTML)),
  );
  expect(before.length).toBeGreaterThan(0);
  await expect(page.getByTestId("freshness-notice")).toHaveText(
    es.freshness.offline,
    { timeout: 15_000 },
  );
  const after = strip(
    await page
      .getByTestId("match-row")
      .evaluateAll((rows) => rows.map((r) => r.outerHTML)),
  );
  expect(after).toEqual(before);
});

test("CA-5 on: folded competition and #f=live; a Decision to finished leaves the view, counters follow, fold and fragment stay", async ({
  page,
}) => {
  const id = free[1];
  await decide(id, { status: "live", home: 2, away: 1, minute: 80 });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#f=live");
  await expect
    .poll(() => transport(page), { timeout: 15_000 })
    .toBe("realtime");
  // The catch-up request on SUBSCRIBED brings the live match if the served
  // page was older.
  await expect(row(page, id)).toHaveAttribute("data-status", "live");
  await expect(row(page, id)).toBeVisible();
  const competition = await row(page, id)
    .locator("xpath=ancestor::section[@data-competition]")
    .getAttribute("data-competition");
  const other = await page
    .locator(
      `section[data-competition]:not([data-competition="${competition}"])`,
    )
    .first()
    .getAttribute("data-competition");
  await page.locator(`[data-competition-toggle="${other}"]`).click();
  await expect(page.locator(`#rows-${other}`)).not.toHaveAttribute("open");
  const live = Number(await page.locator('[data-count="live"]').textContent());
  await decide(id, { status: "finished", home: 2, away: 1, minute: null });
  await expect(row(page, id)).toHaveAttribute("data-status", "finished", {
    timeout: 5_000,
  });
  await expect(row(page, id)).toBeHidden();
  await expect(page.locator('[data-count="live"]')).toHaveText(
    String(live - 1),
  );
  await expect(page.locator(`#rows-${other}`)).not.toHaveAttribute("open");
  expect(new URL(page.url()).hash).toBe("#f=live");
});

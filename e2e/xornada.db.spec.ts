import { mkdirSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";
import { LOCAL_DATABASE_URL } from "../playwright.db.config";
import { currentXornada, seasonOf } from "../src/board/current";
import type { XornadaIndexEntry } from "../src/board/row";
import { es } from "../src/i18n/es";
import { gl } from "../src/i18n/gl";

// SPEC-020 CA-6 and CA-7 over the local Supabase with the e2e:db seed. The
// expected selection is computed here from the same index (CA-5).
const CACHE = "public, s-maxage=10, stale-while-revalidate=30";
const CAPTURES = process.env.QA_CAPTURE_DIR;

async function readIndex(): Promise<XornadaIndexEntry[]> {
  const sql = postgres(LOCAL_DATABASE_URL, { ssl: false, max: 1 });
  try {
    const rows =
      await sql`select match_id, competition_id, season, round, kickoff, status
      from web.xornada where season = ${seasonOf(new Date().toISOString())}`;
    return rows.map((r) => ({
      matchId: r.match_id,
      competitionId: r.competition_id,
      season: r.season,
      round: r.round,
      kickoff: r.kickoff.toISOString(),
      status: r.status,
    })) as XornadaIndexEntry[];
  } finally {
    await sql.end();
  }
}

const idsOn = (page: Page): Promise<string[]> =>
  page
    .getByTestId("match-row")
    .evaluateAll((rows) =>
      rows.map((r) => r.getAttribute("data-match-id") ?? ""),
    );

const texts = (page: Page, testId: string): Promise<string[]> =>
  page
    .getByTestId(testId)
    .evaluateAll((els) => els.map((el) => el.textContent ?? ""));

let index: XornadaIndexEntry[];
let expected: string[];

test.beforeAll(async () => {
  index = await readIndex();
  expected = currentXornada(index, new Date().toISOString())
    .map((e) => e.matchId)
    .sort();
});

for (const route of [
  { path: "/", lang: "gl", dict: gl },
  { path: "/es", lang: "es", dict: es },
] as const) {
  test(`CA-6 ${route.path}: without JS, the rows of the current xornada and none of another round`, async ({
    browser,
  }) => {
    expect(expected.length).toBeGreaterThan(10);
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    const response = await page.goto(route.path);
    expect(response?.status()).toBe(200);
    expect(response?.headers()["cache-control"]).toBe(CACHE);
    await expect(page.locator("html")).toHaveAttribute("lang", route.lang);
    await expect(page.getByTestId("xornada-unavailable")).toHaveCount(0);
    const ids = await idsOn(page);
    expect([...ids].sort()).toEqual(expected);
    // Other rounds exist in the index and do not reach the screen, unless live.
    const others = index.filter(
      (e) => !expected.includes(e.matchId) && e.status !== "live",
    );
    expect(others.length).toBeGreaterThan(0);
    for (const e of others) expect(ids).not.toContain(e.matchId);
    // The seed: every state, and a live match of an earlier round (H-2).
    const statuses = await page
      .getByTestId("match-row")
      .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-status")));
    expect(new Set(statuses)).toEqual(
      new Set(["scheduled", "live", "finished", "postponed", "suspended"]),
    );
    const rounds = new Map<string, XornadaIndexEntry>(
      index.map((e) => [e.matchId, e]),
    );
    const live = ids
      .map((id) => rounds.get(id))
      .filter((e) => e?.status === "live");
    const roundsOfLive = new Set(
      live.map((e) => `${e?.competitionId}:${e?.round}`),
    );
    expect(roundsOfLive.size).toBeGreaterThan(1);
    await context.close();
  });

  test(`CA-6 ${route.path}: noindex`, async ({ page }) => {
    await page.goto(route.path);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
  });
}

test("CA-6 team and competition names identical in gl and es", async ({
  page,
}) => {
  await page.goto("/");
  const glTeams = await texts(page, "team-name");
  const glCompetitions = await texts(page, "competition-name");
  expect(glTeams.length).toBeGreaterThan(0);
  await page.goto("/es");
  expect(await texts(page, "team-name")).toEqual(glTeams);
  expect(await texts(page, "competition-name")).toEqual(glCompetitions);
});

test("CA-7 /api/board: the same selection, cache, ETag and 304", async ({
  request,
}) => {
  const response = await request.get("/api/board");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe(CACHE);
  const etag = response.headers().etag;
  expect(etag).toMatch(/^"[\w-]+"$/);
  const body = (await response.json()) as { matches: { matchId: string }[] };
  expect(body.matches.map((m) => m.matchId).sort()).toEqual(expected);
  const again = await request.get("/api/board", {
    headers: { "If-None-Match": etag },
  });
  expect(again.status()).toBe(304);
  expect(await again.text()).toBe("");
});

// SPEC-021 CA-6, CA-7: the seed puts one live match at half-time (minute 45
// stored). /api/board says halfTime true and the home says «Descanso».
test("SPEC-021 /api/board carries halfTime and / and /es say Descanso", async ({
  page,
  request,
}) => {
  const body = (await (await request.get("/api/board")).json()) as {
    matches: { matchId: string; status: string; halfTime?: boolean }[];
  };
  const atHalfTime = body.matches.filter((m) => m.halfTime === true);
  expect(atHalfTime).toHaveLength(1);
  expect(atHalfTime[0]).toMatchObject({ status: "live", minute: 45 });
  for (const m of body.matches)
    if (m.status === "live") expect(typeof m.halfTime).toBe("boolean");
    else expect(m).not.toHaveProperty("halfTime");
  for (const [path, dict] of [
    ["/", gl],
    ["/es", es],
  ] as const) {
    await page.goto(path);
    const row = page.locator(
      `[data-testid="match-row"][data-match-id="${atHalfTime[0].matchId}"]`,
    );
    await expect(row).toHaveAttribute("data-status", "live");
    await expect(row.getByTestId("match-margin")).toHaveText(
      dict.xornada.halfTime,
    );
    expect(await row.textContent()).not.toMatch(/\d+(\+\d+)?'/);
  }
});

test("QA captures of / and /es at 390 px", async ({ page }) => {
  test.skip(!CAPTURES, "QA_CAPTURE_DIR not set");
  mkdirSync(CAPTURES ?? "", { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [path, name] of [
    ["/", "xornada-gl-390.png"],
    ["/es", "xornada-es-390.png"],
  ]) {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${CAPTURES}/${name}`, fullPage: true });
  }
});

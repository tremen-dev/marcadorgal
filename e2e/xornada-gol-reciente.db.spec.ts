import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";
import { LOCAL_DATABASE_URL } from "../playwright.db.config";
import { currentXornada, seasonOf } from "../src/board/current";
import type { XornadaIndexEntry } from "../src/board/row";

// SPEC-041 CA-6 e2e:db, polling only (the socket closed): a Decision that
// raises the home score marks it within one cycle; another that lowers it
// (a goal disallowed) takes the mark away. Over a scheduled match of the
// current xornada the seed leaves without Decision (the last one, so the
// Realtime cases keep theirs); the teardown resets the local database.

const sql = postgres(LOCAL_DATABASE_URL, { ssl: false, max: 1 });
let matchId: string;
// One polling cycle is 30 s plus its jitter (SPEC-024 CA-7).
const CYCLE = 45_000;

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
  const free = currentXornada(index, now)
    .filter((e) => unseeded.has(e.matchId))
    .map((e) => e.matchId)
    .sort();
  expect(free.length).toBeGreaterThan(0);
  matchId = free[free.length - 1];
});

test.afterAll(() => sql.end());

async function decide(home: number, away: number): Promise<void> {
  const values = {
    status: "live",
    home_score: home,
    away_score: away,
    minute: 20,
  };
  await sql.begin(async (tx) => {
    const [{ id }] = await tx`insert into observations ${tx({
      match_id: matchId,
      source_id: "e2e-gol-reciente",
      observed_at: new Date().toISOString(),
      raw_ref: "e2e/gol-reciente.json",
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

const marks = (page: Page) =>
  page
    .locator(`[data-testid="match-row"][data-match-id="${matchId}"]`)
    .getByTestId("score")
    .evaluateAll((els) => els.map((el) => el.hasAttribute("data-recent-goal")));

test("SPEC-041 CA-6 polling: a goal marks the home number in one cycle; disallowed, the mark goes", async ({
  page,
}) => {
  test.setTimeout(3 * CYCLE);
  await page.routeWebSocket(/\/realtime\/v1\//, (ws) => ws.close());
  // Live 0-0 before the page opens, the goal after: the view needs the
  // previous Decision live too (ADR-022 §2).
  await decide(0, 0);
  await page.goto("/");
  await decide(1, 0);
  await expect
    .poll(() => marks(page), { timeout: CYCLE })
    .toEqual([true, false]);
  await decide(0, 0);
  await expect
    .poll(() => marks(page), { timeout: CYCLE })
    .toEqual([false, false]);
});

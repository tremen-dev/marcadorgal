import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { LOCAL_DATABASE_URL } from "../playwright.db.config";
import { seasonOf } from "../src/board/current";
import type { XornadaIndexEntry } from "../src/board/row";
import {
  homeWeek,
  neighbourWeeks,
  seasonWeeks,
  weekXornada,
} from "../src/board/weeks";

// SPEC-060 CA-6 (V-6) over the local Supabase with the e2e:db seed: a match
// of a past week with a final and goals in match_goals, as historico:sync
// leaves it; web.xornada exposes them and the accordion of MatchRow
// (SPEC-056) shows the scorer and the minute on /xornada/[fecha]. The
// teardown resets the local database.

const sql = postgres(LOCAL_DATABASE_URL, { ssl: false, max: 1 });
let week: string;
let matchId: string;

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
  const home = homeWeek(index, now) ?? "";
  week = neighbourWeeks(seasonWeeks(index), home).previous ?? "";
  expect(week).not.toBe("");
  const unseeded = new Set(
    rows.filter((r) => r.version === 0).map((r) => r.match_id),
  );
  const candidates = weekXornada(index, week)
    .filter((e) => unseeded.has(e.matchId))
    .map((e) => e.matchId)
    .sort();
  expect(candidates.length).toBeGreaterThan(0);
  matchId = candidates[0];

  // The final 2-1 the operator published (ADR-031) and its three goals.
  await sql.begin(async (tx) => {
    const [{ id }] = await tx`insert into observations ${tx({
      match_id: matchId,
      source_id: "operator",
      status: "finished",
      home_score: 2,
      away_score: 1,
      observed_at: now,
      raw_ref: "e2e/historico.json",
    })} returning id`;
    await tx`insert into decisions ${tx({
      match_id: matchId,
      status: "finished",
      home_score: 2,
      away_score: 1,
      qualifier: "confirmado",
      rule: "operator",
      observation_ids: [id],
    })}`;
    await tx`delete from match_goals where match_id = ${matchId}`;
    await tx`insert into match_goals (match_id, team, player, minute, penalty)
      values (${matchId}, 'home', 'Aspas E2E', 23, false),
        (${matchId}, 'away', 'Budimir E2E', 60, true),
        (${matchId}, 'home', 'Swedberg E2E', 85, false)`;
  });
});

test.afterAll(() => sql.end());

test("SPEC-060 CA-6 a past week shows the scorers and minutes of match_goals in the accordion", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const row = page.locator(
    `[data-testid="match-row"][data-match-id="${matchId}"]`,
  );
  // ISR of 10 s (SPEC-027): if another spec rendered this week before the
  // seed, a reload after the revalidation brings the goals.
  await expect(async () => {
    await page.goto(`/xornada/${week}`);
    await expect(row).toHaveAttribute("data-has-goals", "true", {
      timeout: 2_000,
    });
  }).toPass({ timeout: 60_000, intervals: [1_000, 5_000, 11_000] });

  const goals = row.getByTestId("match-goals");
  await expect(goals).toHaveAttribute("data-expanded", "false");
  await row.click();
  await expect(row).toHaveAttribute("aria-expanded", "true");
  await expect(goals).toHaveAttribute("data-expanded", "true");
  await expect(goals.locator('[data-team="home"]').first()).toBeVisible();
  await expect(goals).toContainText("Aspas E2E 23'");
  await expect(goals).toContainText("Budimir E2E 60'");
  await expect(goals).toContainText("(p.)");
  await expect(goals).toContainText("Swedberg E2E 85'");
  await expect(row).toHaveAttribute("data-status", "finished");
});

import { mkdirSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { es } from "../src/i18n/es";
import { gl } from "../src/i18n/gl";

// SPEC-019: the Xornada screen over the demonstration data.
const routes = [
  { path: "/demo/xornada", lang: "gl", dict: gl, other: "/es/demo/xornada" },
  { path: "/es/demo/xornada", lang: "es", dict: es, other: "/demo/xornada" },
] as const;

const MINUTE = /^\d+(\+\d+)?'$/;
const CAPTURES = process.env.QA_CAPTURE_DIR;

type RowInfo = {
  status: string;
  qualifier: string;
  text: string;
  margin: string;
};

const rowsOf = (page: Page): Promise<RowInfo[]> =>
  page.getByTestId("match-row").evaluateAll((rows) =>
    rows.map((row) => ({
      status: row.getAttribute("data-status") ?? "",
      qualifier: row.getAttribute("data-qualifier") ?? "",
      text: row.textContent ?? "",
      margin:
        row.querySelector('[data-testid="match-margin"]')?.textContent ?? "",
    })),
  );

const texts = (page: Page, testId: string): Promise<string[]> =>
  page
    .getByTestId(testId)
    .evaluateAll((els) => els.map((el) => el.textContent ?? ""));

for (const route of routes) {
  test.describe(`${route.path} (${route.lang})`, () => {
    test("CA-3 every row says its state, minute or time and its qualifier", async ({
      page,
    }) => {
      await page.goto(route.path);
      const rows = await rowsOf(page);
      expect(rows.length).toBeGreaterThanOrEqual(20);
      for (const row of rows) {
        const status = row.status as keyof typeof route.dict.status;
        if (row.status !== "scheduled") {
          const saysIt =
            row.margin === route.dict.status[status] ||
            (row.status === "live" && MINUTE.test(row.margin)) ||
            (row.status === "live" &&
              row.margin === route.dict.xornada.halfTime);
          expect(saysIt, `${row.status}: ${row.text}`).toBe(true);
          expect(row.text).toContain(route.dict.status[status]);
        } else {
          expect(row.margin, row.text).toMatch(/^\d{2}:\d{2}$/);
        }
        if (row.qualifier !== "confirmado") {
          const qualifier = row.qualifier as keyof typeof route.dict.qualifier;
          expect(row.text, row.text).toContain(route.dict.qualifier[qualifier]);
        }
      }
      // Every state and qualifier of the demonstration reaches the screen.
      expect(new Set(rows.map((r) => r.status))).toEqual(
        new Set(["scheduled", "live", "finished", "postponed", "suspended"]),
      );
      expect(new Set(rows.map((r) => r.qualifier))).toEqual(
        new Set(["confirmado", "provisional", "sen_sinal"]),
      );
      expect(rows.map((r) => r.margin)).toContain("45+3'");
      expect(rows.map((r) => r.margin)).toContain("46'");
    });

    test("CA-3 domain literals only: no FIN, APR, DESC, ? or !", async ({
      page,
    }) => {
      await page.goto(route.path);
      const text = (await page.locator("main").textContent()) ?? "";
      expect(text).not.toMatch(/\b(FIN|APR|DESC)\b/);
      expect(text).not.toMatch(/[?!]/);
    });

    test("CA-3 scheduled and postponed show «–»; scores are tabular", async ({
      page,
    }) => {
      await page.goto(route.path);
      for (const status of ["scheduled", "postponed"]) {
        const scores = page.locator(
          `[data-status="${status}"] [data-testid="score"]`,
        );
        expect(await scores.count()).toBeGreaterThan(0);
        for (const score of await scores.allTextContents()) {
          expect(score).toBe("–");
        }
      }
      const scores = page.getByTestId("score");
      const count = await scores.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        await expect(scores.nth(i)).toHaveCSS(
          "font-variant-numeric",
          "tabular-nums",
        );
      }
    });

    test("CA-3 competition header: live pill with its accessible label", async ({
      page,
    }) => {
      await page.goto(route.path);
      const competitions = page.getByTestId("competition");
      await expect(competitions).toHaveCount(5);
      for (let i = 0; i < 5; i++) {
        const competition = competitions.nth(i);
        const live = await competition
          .locator('[data-testid="match-row"][data-status="live"]')
          .count();
        const pill = competition.getByTestId("live-pill");
        if (live === 0) {
          await expect(pill).toHaveCount(0);
        } else {
          const label = route.dict.xornada.liveCount.replace(
            "{n}",
            String(live),
          );
          await expect(pill).toContainText(String(live));
          await expect(pill).toContainText(label);
        }
      }
    });

    for (const width of [360, 390]) {
      test(`CA-4 nothing is truncated at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        await page.goto(route.path);
        const names = await texts(page, "team-name");
        expect(names).toContain("Bilbao Athletic");
        expect(await texts(page, "competition-name")).toContain(
          "Terceira Federación · Grupo 1",
        );
        const offenders = await page
          .locator(
            '[data-testid="team-name"], [data-testid="competition-name"]',
          )
          .evaluateAll((els) =>
            els
              .filter((el) => {
                const style = getComputedStyle(el);
                return (
                  el.scrollWidth > el.clientWidth ||
                  style.textOverflow === "ellipsis"
                );
              })
              .map((el) => el.textContent),
          );
        expect(offenders).toEqual([]);
        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth,
        );
        expect(overflow).toBe(false);
      });
    }

    // SPEC-021 CA-7: half-time is a moment inside live. The row stays live,
    // says «Descanso» and no minute, keeps the ember inset, has no dot, and
    // its margin does not overflow.
    for (const width of [360, 390]) {
      test(`SPEC-021 CA-7 half-time row at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        await page.goto(route.path);
        const halfTime = route.dict.xornada.halfTime;
        const rows = page.getByTestId("match-row").filter({
          has: page.getByTestId("match-margin").getByText(halfTime),
        });
        await expect(rows).toHaveCount(2);
        for (let i = 0; i < 2; i++) {
          const row = rows.nth(i);
          await expect(row).toHaveAttribute("data-status", "live");
          await expect(row.getByTestId("match-margin")).toHaveText(halfTime);
          await expect(row).toContainText(route.dict.status.live);
          expect(await row.textContent()).not.toMatch(/\d+(\+\d+)?'/);
          const fits = await row
            .getByTestId("match-margin")
            .evaluate((el) => el.scrollWidth <= el.clientWidth);
          expect(fits).toBe(true);
        }
        // Confirmed: ember inset and no dot. Sen sinal: red, with its label.
        const ok = rows.and(page.locator('[data-qualifier="confirmado"]'));
        await expect(ok).toHaveCount(1);
        await expect(ok.locator('[class*="dot"]')).toHaveCount(0);
        expect(await ok.getAttribute("class")).toMatch(/live/);
        const noSignal = rows.and(page.locator('[data-qualifier="sen_sinal"]'));
        await expect(noSignal).toHaveCount(1);
        await expect(noSignal).toContainText(route.dict.qualifier.sen_sinal);
        expect(await noSignal.getAttribute("class")).toMatch(/noSignal/);
        // Still counted in the «en xogo» pill of its competition.
        const competition = page.getByTestId("competition").filter({ has: ok });
        const live = await competition
          .locator('[data-testid="match-row"][data-status="live"]')
          .count();
        await expect(competition.getByTestId("live-pill")).toContainText(
          route.dict.xornada.liveCount.replace("{n}", String(live)),
        );
        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth,
        );
        expect(overflow).toBe(false);
        if (CAPTURES) {
          mkdirSync(CAPTURES, { recursive: true });
          await page.evaluate(() => document.fonts.ready);
          await competition.screenshot({
            path: `${CAPTURES}/descanso-${route.lang}-${width}.png`,
          });
        }
      });
    }

    test("CA-5 noindex and the same rows without JavaScript", async ({
      page,
      browser,
    }) => {
      await page.goto(route.path);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        /noindex/,
      );
      const withJs = await rowsOf(page);
      const context = await browser.newContext({ javaScriptEnabled: false });
      const noJs = await context.newPage();
      const response = await noJs.goto(route.path);
      expect(response?.status()).toBe(200);
      expect(await rowsOf(noJs)).toEqual(withJs);
      await context.close();
    });

    test("CA-6 locale switch links to the same screen in the other language", async ({
      page,
    }) => {
      await page.goto(route.path);
      await expect(page.locator("html")).toHaveAttribute("lang", route.lang);
      const switcher = page.getByTestId("locale-switch");
      await expect(
        switcher.locator(`a[hreflang="${route.lang === "gl" ? "es" : "gl"}"]`),
      ).toHaveAttribute("href", route.other);
      await expect(switcher.locator('a[aria-current="page"]')).toHaveAttribute(
        "href",
        route.path,
      );
    });
  });
}

test("CA-6 es: states and qualifiers in castellano, names identical to gl", async ({
  page,
}) => {
  await page.goto("/demo/xornada");
  const glTeams = await texts(page, "team-name");
  const glCompetitions = await texts(page, "competition-name");
  const glRows = await rowsOf(page);
  await page.goto("/es/demo/xornada");
  expect(await texts(page, "team-name")).toEqual(glTeams);
  expect(await texts(page, "competition-name")).toEqual(glCompetitions);
  const esRows = await rowsOf(page);
  expect(esRows.map((r) => r.status)).toEqual(glRows.map((r) => r.status));
  const esText = esRows.map((r) => r.text).join(" ");
  expect(esText).toContain(es.status.finished);
  expect(esText).toContain(es.status.postponed);
  expect(esText).toContain(es.qualifier.sen_sinal);
  expect(esText).not.toContain(gl.status.finished);
  expect(esText).not.toContain(gl.qualifier.sen_sinal);
});

test("CA-6 kickoff times in Europe/Madrid", async ({ page }) => {
  await page.goto("/demo/xornada");
  // Athletic Club – Real Sociedad: 2026-10-03T19:00:00Z is 21:00 in Madrid.
  const row = page
    .getByTestId("match-row")
    .filter({ hasText: "Real Sociedad" })
    .filter({ hasText: "Athletic" });
  await expect(row.getByTestId("match-margin")).toHaveText("21:00");
});

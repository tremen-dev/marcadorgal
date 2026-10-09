import { expect, test } from "@playwright/test";
import { weekOf } from "../src/board/weeks";
import { es } from "../src/i18n/es";
import { gl } from "../src/i18n/gl";

// SPEC-027 CA-3, CA-4 and CA-5 without a reader (DATABASE_URL_PUBLIC empty)
// and with the Realtime switch off: the dates decide 308 and 404 alone; a
// week key says the xornada is unavailable, with no rows, no arrows and
// nothing asked of /api/board or a socket.
const CACHE = "public, s-maxage=10, stale-while-revalidate=30";
// A week key of the season of now, whatever the date of the run.
const thisWeek = weekOf(new Date().toISOString());

for (const { prefix, lang, dict } of [
  { prefix: "", lang: "gl", dict: gl },
  { prefix: "/es", lang: "es", dict: es },
] as const) {
  test(`CA-3 ${prefix}/xornada/[fecha] without a reader: unavailable, no rows, no arrows, no live`, async ({
    page,
  }) => {
    const board: string[] = [];
    const sockets: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/board")) board.push(r.url());
    });
    page.on("websocket", (ws) => sockets.push(ws.url()));
    const response = await page.goto(`${prefix}/xornada/${thisWeek}`);
    expect(response?.status()).toBe(200);
    expect(response?.headers()["cache-control"]).toBe(CACHE);
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    await expect(page.getByTestId("xornada-unavailable")).toHaveText(
      dict.xornada.unavailable,
    );
    await expect(page.getByTestId("match-row")).toHaveCount(0);
    await expect(page.getByTestId("week-strip")).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
    await page.waitForTimeout(1_500);
    expect(board).toEqual([]);
    expect(sockets).toEqual([]);
  });

  test(`CA-3 ${prefix}/xornada/[fecha]: 308 to the Saturday, 404 for what is not a date`, async ({
    request,
  }) => {
    const get = (path: string) => request.get(path, { maxRedirects: 0 });
    for (const [day, saturday] of [
      ["2026-10-06", "2026-10-10"],
      ["2026-10-12", "2026-10-10"],
      ["2026-10-27", "2026-10-31"],
    ]) {
      const r = await get(`${prefix}/xornada/${day}`);
      expect(r.status()).toBe(308);
      // next start repeats an identical Location on a cache MISS
      // (F-SPEC-027-1); one value is what counts.
      expect([...new Set(r.headers().location.split(", "))]).toEqual([
        `${prefix}/xornada/${saturday}`,
      ]);
    }
    for (const bad of ["2026-02-30", "2026-10-3", "hoxe"])
      expect((await get(`${prefix}/xornada/${bad}`)).status()).toBe(404);
    // A Saturday outside the years of the season of now: 404 before any
    // read (without a reader a week key would say unavailable, 200).
    expect((await get(`${prefix}/xornada/1990-01-06`)).status()).toBe(404);
  });

  test(`CA-3 ${prefix}/xornada/[fecha]: a browser follows the 308 of a first visit to the Saturday`, async ({
    page,
  }) => {
    const response = await page.goto(`${prefix}/xornada/2026-11-03`);
    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe(`${prefix}/xornada/2026-11-07`);
  });
}

import { readFileSync } from "node:fs";
import path from "node:path";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { analyticsPort } from "../playwright.config";

// SPEC-077 CA-3, CA-4, CA-5: Vercel Web Analytics on the build served with
// VERCEL_ENV=production. Never the network: the insights script is a copy of
// https://va.vercel-scripts.com/v1/script.js taken on 2026-11-10 (sv 0.1.3,
// sha256 050e35bf…0ba4c) and the view endpoint is answered here.

const ORIGIN = `http://localhost:${analyticsPort}`;
const BASELINE = "http://localhost:3100";
const SCRIPT = readFileSync(
  path.join("e2e", "fixtures", "vercel-insights-script.js"),
);
const SCRIPT_PATH = "/_vercel/insights/script.js";
const VIEW_PATH = "/_vercel/insights/view";
// A Saturday of the season that no other e2e visits: its ISR entry is
// rendered by this server, with its environment (SPEC-027 CA-4).
const WEEK = "/xornada/2026-12-12";
const ROUTES = ["/", "/es", WEEK] as const;
// After the script ran, how long a second (wrong) view would take to show.
const SETTLE_MS = 1_500;
// The real script also bails out on «Headless» in the User-Agent.
const VISITOR_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

type Traffic = { urls: string[]; views: { o?: string }[] };

async function serveInsights(
  context: BrowserContext,
  page: Page,
): Promise<Traffic> {
  const traffic: Traffic = { urls: [], views: [] };
  await context.route(`**${SCRIPT_PATH}`, (route) =>
    route.fulfill({ contentType: "application/javascript", body: SCRIPT }),
  );
  await context.route(`**${VIEW_PATH}`, (route) => {
    traffic.views.push(route.request().postDataJSON() ?? {});
    return route.fulfill({ status: 200, body: "OK" });
  });
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith("data:") && !url.startsWith("blob:"))
      traffic.urls.push(url);
  });
  return traffic;
}

async function load(page: Page, traffic: Traffic, route: string) {
  traffic.urls.length = 0;
  traffic.views.length = 0;
  const script = page.waitForRequest((r) => r.url().endsWith(SCRIPT_PATH));
  const response = await page.goto(`${ORIGIN}${route}`);
  expect(response?.status(), route).toBe(200);
  await script;
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(SETTLE_MS);
}

test.describe("SPEC-077 a visitor's browser", () => {
  test.use({ userAgent: VISITOR_UA });

  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "webdriver", {
        get: () => false,
        configurable: true,
      });
    });
  });

  for (const route of ROUTES) {
    test(`CA-3 ${route}: one view, same origin, no cookie, no storage`, async ({
      context,
      page,
    }, testInfo) => {
      const traffic = await serveInsights(context, page);
      await load(page, traffic, route);

      expect(await page.evaluate(() => navigator.webdriver)).toBe(false);
      expect(traffic.views).toHaveLength(1);
      expect(traffic.views[0].o).toBe(`${ORIGIN}${route}`);
      const foreign = traffic.urls.filter(
        (url) => new URL(url).origin !== ORIGIN,
      );
      expect(foreign).toEqual([]);
      expect(await context.cookies()).toEqual([]);
      const storage = await page.evaluate(() => ({
        localStorage: Object.keys(localStorage),
        sessionStorage: Object.keys(sessionStorage),
      }));
      testInfo.annotations.push({
        type: "storage",
        description: `${route} ${JSON.stringify(storage)}`,
      });
      expect(storage).toEqual({ localStorage: [], sessionStorage: [] });
    });
  }

  test("CA-3 the view leaves with the query filtered by beforeSend", async ({
    context,
    page,
  }) => {
    const traffic = await serveInsights(context, page);
    await load(page, traffic, `${WEEK}?x=1&utm_source=e2e#a`);
    expect(traffic.views).toHaveLength(1);
    expect(traffic.views[0].o).toBe(`${ORIGIN}${WEEK}?utm_source=e2e`);
  });

  test("CA-5 the HTML of / carries no new script; the injected one is deferred", async ({
    context,
    page,
    request,
  }) => {
    const blockingIn = async (origin: string) => {
      const html = await (await request.get(`${origin}/`)).text();
      const tags = [...html.matchAll(/<script\b[^>]*\bsrc="[^"]*"[^>]*>/g)]
        .map((m) => m[0])
        .filter((tag) => !/\basync\b|\bdefer\b|type="module"/.test(tag));
      return { html, tags };
    };
    // The same build without Web Analytics (VERCEL_ENV=development).
    const before = await blockingIn(BASELINE);
    const after = await blockingIn(ORIGIN);
    expect(after.html).not.toContain("_vercel/insights");
    expect(after.html).not.toContain("vercel-scripts");
    expect(after.tags).toEqual(before.tags);

    const traffic = await serveInsights(context, page);
    await load(page, traffic, "/");
    const injected = await page.evaluate(
      (src) =>
        [...document.scripts]
          .filter((s) => s.src.endsWith(src))
          .map((s) => ({ defer: s.defer, async: s.async })),
      SCRIPT_PATH,
    );
    expect(injected).toEqual([{ defer: true, async: true }]);
  });
});

test.describe("SPEC-077 our probes (navigator.webdriver untouched)", () => {
  for (const route of ROUTES) {
    test(`CA-4 ${route}: zero views`, async ({ context, page }) => {
      const traffic = await serveInsights(context, page);
      await load(page, traffic, route);
      expect(await page.evaluate(() => navigator.webdriver)).toBe(true);
      expect(traffic.views).toEqual([]);
      expect(traffic.urls.filter((url) => url.endsWith(VIEW_PATH))).toEqual([]);
    });
  }
});

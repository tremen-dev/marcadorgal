import { describe, expect, it } from "vitest";
import { beforeSend } from "./before-send";

// SPEC-077 CA-2: what leaves the browser, filtered before it is sent.
const view = (url: string) => ({ type: "pageview" as const, url });

describe("beforeSend (SPEC-077 CA-2)", () => {
  it("drops every event of an automated browser", () => {
    expect(beforeSend(view("/"), { webdriver: true })).toBeNull();
    expect(
      beforeSend(view("https://marcador.gal/es"), { webdriver: true }),
    ).toBeNull();
  });

  it.each([
    "/api/board",
    "/api",
    "/demo",
    "/demo/xornada",
    "/es/demo",
    "/es/demo/xornada?x=1",
    "https://marcador.gal/api/board",
    "https://marcador.gal/es/demo/xornada",
  ])("drops the non-public route %s", (url) => {
    expect(beforeSend(view(url), { webdriver: false })).toBeNull();
  });

  it.each([
    [
      "/xornada/2026-11-15?x=1&utm_source=x#a",
      "/xornada/2026-11-15?utm_source=x",
    ],
    [
      "https://marcador.gal/xornada/2026-11-15?x=1&utm_source=x#a",
      "https://marcador.gal/xornada/2026-11-15?utm_source=x",
    ],
    [
      "/es/xornada/2026-11-15?utm_medium=m&fbclid=1&utm_campaign=c",
      "/es/xornada/2026-11-15?utm_medium=m&utm_campaign=c",
    ],
    ["/clasificacion?liga=1#top", "/clasificacion"],
    ["/", "/"],
    ["/es", "/es"],
    ["https://marcador.gal/", "https://marcador.gal/"],
    ["https://marcador.gal/es", "https://marcador.gal/es"],
  ])("rewrites %s to %s", (url, expected) => {
    expect(beforeSend(view(url), { webdriver: false })).toEqual(view(expected));
  });

  it("keeps routes that only start like a non-public one", () => {
    expect(beforeSend(view("/demolicion"), { webdriver: false })).toEqual(
      view("/demolicion"),
    );
    expect(beforeSend(view("/apia"), { webdriver: false })).toEqual(
      view("/apia"),
    );
  });

  it("keeps the event type and does not mutate the input", () => {
    const input = { type: "event" as const, url: "/xornada/2026-11-15?x=1" };
    const out = beforeSend(input, { webdriver: false });
    expect(out).toEqual({ type: "event", url: "/xornada/2026-11-15" });
    expect(input.url).toBe("/xornada/2026-11-15?x=1");
  });
});

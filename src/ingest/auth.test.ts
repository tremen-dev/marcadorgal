import { describe, expect, it } from "vitest";
import { authorizeTick } from "./auth.ts";

const TOKEN = "0123456789abcdef0123456789abcdef";
const env = { INGEST_TICK_TOKEN: TOKEN };

describe("CA-9 authorizeTick", () => {
  it("is unconfigured without a token", () => {
    expect(authorizeTick(`Bearer ${TOKEN}`, {})).toBe("unconfigured");
  });

  it("is unconfigured with a token shorter than thirty two characters", () => {
    const short = TOKEN.slice(0, 31);
    expect(authorizeTick(`Bearer ${short}`, { INGEST_TICK_TOKEN: short })).toBe(
      "unconfigured",
    );
  });

  it("accepts exactly thirty two characters", () => {
    expect(authorizeTick(`Bearer ${TOKEN}`, env)).toBe("ok");
  });

  it.each([
    ["no header", null],
    ["another scheme", `Basic ${TOKEN}`],
    ["no scheme", TOKEN],
    ["an empty token", "Bearer "],
    ["extra parts", `Bearer ${TOKEN} more`],
    ["a shorter token", `Bearer ${TOKEN.slice(0, 20)}`],
    ["a longer token", `Bearer ${TOKEN}0`],
    ["a token of the same length", `Bearer ${"f".repeat(TOKEN.length)}`],
  ])("refuses %s", (_name, header) => {
    expect(authorizeTick(header, env)).toBe("unauthorized");
  });

  it("does not care about the case of the token itself", () => {
    expect(authorizeTick(`Bearer ${TOKEN.toUpperCase()}`, env)).toBe(
      "unauthorized",
    );
  });
});

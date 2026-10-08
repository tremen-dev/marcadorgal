import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { authorizeTick } from "./auth.ts";

const TOKEN = "0123456789abcdef0123456789abcdef";
const env = { INGEST_TICK_TOKEN: TOKEN };
// Any instant: the static bearer does not depend on it.
const NOW = "2026-10-07T20:00:00Z";
const NOW_EPOCH = Date.parse(NOW) / 1000;

describe("ADR-008 §1 authorizeTick, static bearer", () => {
  it("is unconfigured without a token", () => {
    expect(authorizeTick(`Bearer ${TOKEN}`, {}, NOW)).toBe("unconfigured");
  });

  it("is unconfigured with a token shorter than thirty two characters", () => {
    const short = TOKEN.slice(0, 31);
    expect(
      authorizeTick(`Bearer ${short}`, { INGEST_TICK_TOKEN: short }, NOW),
    ).toBe("unconfigured");
  });

  it("accepts exactly thirty two characters", () => {
    expect(authorizeTick(`Bearer ${TOKEN}`, env, NOW)).toBe("ok");
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
    expect(authorizeTick(header, env, NOW)).toBe("unauthorized");
  });

  it("does not care about the case of the token itself", () => {
    expect(authorizeTick(`Bearer ${TOKEN.toUpperCase()}`, env, NOW)).toBe(
      "unauthorized",
    );
  });
});

// SPEC-020 CA-9 (ADR-015 §2): what pg_cron sends instead of the token.
const sign = (epoch: number | string, key = TOKEN, prefix = "t1") =>
  createHmac("sha256", key).update(`${prefix}.${epoch}`).digest("hex");
const signed = (epoch: number, key = TOKEN) =>
  `Bearer t1.${epoch}.${sign(epoch, key)}`;

describe("SPEC-020 CA-9 authorizeTick, signed bearer", () => {
  it.each([
    ["at 0 s", 0],
    ["60 s in the past", -60],
    ["60 s in the future", 60],
  ])("accepts a signature %s", (_name, offset) => {
    expect(authorizeTick(signed(NOW_EPOCH + offset), env, NOW)).toBe("ok");
  });

  it.each([
    ["61 s in the past", signed(NOW_EPOCH - 61)],
    ["61 s in the future", signed(NOW_EPOCH + 61)],
    ["another key", signed(NOW_EPOCH, "fedcba9876543210fedcba9876543210")],
    [
      "upper-case hex",
      `Bearer t1.${NOW_EPOCH}.${sign(NOW_EPOCH).toUpperCase()}`,
    ],
    [
      "a prefix other than t1",
      `Bearer t2.${NOW_EPOCH}.${sign(NOW_EPOCH, TOKEN, "t2")}`,
    ],
    ["a non-numeric epoch", `Bearer t1.abc.${sign("abc")}`],
    ["a fractional epoch", `Bearer t1.${NOW_EPOCH}.5.${sign(NOW_EPOCH)}`],
    ["a negative epoch", `Bearer t1.-${NOW_EPOCH}.${sign(-NOW_EPOCH)}`],
    ["extra parts", `Bearer t1.${NOW_EPOCH}.${sign(NOW_EPOCH)}.x`],
    ["a missing signature", `Bearer t1.${NOW_EPOCH}`],
    [
      "a truncated signature",
      `Bearer t1.${NOW_EPOCH}.${sign(NOW_EPOCH).slice(1)}`,
    ],
    ["another scheme", `Basic t1.${NOW_EPOCH}.${sign(NOW_EPOCH)}`],
  ])("refuses %s", (_name, header) => {
    expect(authorizeTick(header, env, NOW)).toBe("unauthorized");
  });

  it("is unconfigured without a token, even with a valid-looking signature", () => {
    expect(authorizeTick(signed(NOW_EPOCH), {}, NOW)).toBe("unconfigured");
  });

  it("refuses a signature when now is not an instant", () => {
    expect(authorizeTick(signed(NOW_EPOCH), env, "not an instant")).toBe(
      "unauthorized",
    );
  });

  it("counts whole seconds of now", () => {
    expect(
      authorizeTick(signed(NOW_EPOCH - 60), env, "2026-10-07T20:00:00.999Z"),
    ).toBe("ok");
  });
});

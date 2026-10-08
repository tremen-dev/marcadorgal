import { afterEach, describe, expect, it, vi } from "vitest";
import { realtimeConfig } from "./config";

// SPEC-024 CA-6 (H-6): only the exact value «on» turns Realtime on.

const URL = "http://127.0.0.1:54321";
const KEY = "anon-or-publishable";

afterEach(() => vi.restoreAllMocks());

describe("SPEC-024 CA-6 realtimeConfig", () => {
  it("on, with URL and key: Realtime", () => {
    expect(realtimeConfig({ flag: "on", url: URL, key: KEY })).toEqual({
      url: URL,
      key: KEY,
    });
  });

  it.each([undefined, "", "On", "ON", "true", "1", "yes", " on", "on "])(
    "flag %j: polling only, silently",
    (flag) => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(realtimeConfig({ flag, url: URL, key: KEY })).toBeNull();
      expect(error).not.toHaveBeenCalled();
    },
  );

  it.each([
    [undefined, KEY],
    ["", KEY],
    [URL, undefined],
    [URL, ""],
  ])(
    "on without URL (%j) or key (%j): polling only and a console.error",
    (url, key) => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(realtimeConfig({ flag: "on", url, key })).toBeNull();
      expect(error).toHaveBeenCalledTimes(1);
    },
  );
});

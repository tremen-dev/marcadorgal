import { describe, expect, it } from "vitest";
import { APP_VERSION, getAppVersionDisplay } from "./version";

describe("version", () => {
  it("exposes semantic version from package.json", () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
    expect(getAppVersionDisplay()).toContain(`v${APP_VERSION}`);
  });
});

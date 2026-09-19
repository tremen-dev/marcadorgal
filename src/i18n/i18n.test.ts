import { describe, expect, it } from "vitest";
import { es } from "./es";
import { gl } from "./gl";
import { t } from "./index";

describe("i18n dictionaries", () => {
  it("gl and es expose the same set of keys", () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(gl).sort());
  });

  it("no value is empty in either locale", () => {
    for (const dict of [gl, es]) {
      for (const [key, value] of Object.entries(dict)) {
        expect(value.trim(), `empty value for key "${key}"`).not.toBe("");
      }
    }
  });

  it("t(locale) returns the dictionary of that locale", () => {
    expect(t("gl")).toBe(gl);
    expect(t("es")).toBe(es);
  });
});

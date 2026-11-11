import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LEAGUE_COLORS } from "@/design/tokens";
import { t } from "@/i18n";
import { es } from "@/i18n/es";
import { gl } from "@/i18n/gl";
import {
  ALL_COMPETITION_IDS,
  applyVisibleCompetitionsToDom,
  getStoredVisibleCompetitions,
  KNOWN_COMPETITIONS,
  LEAGUES_PREFERENCES_KEY,
  PRESET_IDS,
  saveStoredVisibleCompetitions,
} from "./league-preferences";

describe("SPEC-057 league-preferences", () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    vi.stubGlobal("window", {
      localStorage: {
        getItem: vi.fn((key: string) => mockStorage[key] ?? null),
        setItem: vi.fn((key: string, val: string) => {
          mockStorage[key] = val;
        }),
        removeItem: vi.fn((key: string) => {
          delete mockStorage[key];
        }),
        clear: vi.fn(() => {
          mockStorage = {};
        }),
      },
      dispatchEvent: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("KNOWN_COMPETITIONS includes all 8 key competitions", () => {
    expect(KNOWN_COMPETITIONS.length).toBe(8);
  });

  // SPEC-057 CA-6 (F-3): each league's colour is a token of tokens.ts,
  // consumed through its CSS variable; never a literal rgb()/hsl()/#hex.
  it("each league colour is a var() of a LEAGUE_COLORS token defined in tokens.css", () => {
    const css = readFileSync("src/design/tokens.css", "utf8");
    for (const comp of KNOWN_COMPETITIONS) {
      const token = LEAGUE_COLORS[comp.id as keyof typeof LEAGUE_COLORS];
      expect(token, comp.id).toBeDefined();
      expect(comp.color).toBe(`var(${token.css})`);
      expect(comp.color).not.toMatch(/rgb|hsl|#/);
      expect(css).toContain(`${token.css}: ${token.value};`);
    }
  });

  it("the source of league-preferences has no literal colour", () => {
    const src = readFileSync("src/lib/league-preferences.ts", "utf8");
    expect(src).not.toMatch(/rgba?\(|hsla?\(|#[0-9a-fA-F]{3,8}\b/);
  });

  // SPEC-057 CA-3 (F-4): the switch names come from the dictionaries.
  it("each nameKey resolves in gl and es, and es names are in Spanish", () => {
    for (const comp of KNOWN_COMPETITIONS) {
      expect(t("gl", comp.nameKey).trim()).not.toBe("");
      expect(t("es", comp.nameKey).trim()).not.toBe("");
    }
    expect(t("gl", "competitions.names.primera-division")).toBe(
      "Primeira División",
    );
    expect(t("es", "competitions.names.primera-division")).toBe(
      "Primera División",
    );
    expect(Object.keys(es.competitions.names)).toEqual(
      Object.keys(gl.competitions.names),
    );
  });

  it("presets partition or include correct categories", () => {
    expect(PRESET_IDS.all).toEqual(ALL_COMPETITION_IDS);
    expect(PRESET_IDS.women).toContain("liga-f");
    expect(PRESET_IDS.women).not.toContain("primera-division");
    expect(PRESET_IDS.modest).toEqual([
      "primera-rfef-g1",
      "segunda-rfef-g1",
      "tercera-rfef-g1",
    ]);
    expect(PRESET_IDS.pro).toEqual(["primera-division", "segunda-division"]);
  });

  it("getStoredVisibleCompetitions returns null when unset or invalid", () => {
    expect(getStoredVisibleCompetitions()).toBeNull();
    mockStorage[LEAGUES_PREFERENCES_KEY] = "invalid json";
    expect(getStoredVisibleCompetitions()).toBeNull();
    mockStorage[LEAGUES_PREFERENCES_KEY] = "[]";
    expect(getStoredVisibleCompetitions()).toBeNull();
  });

  it("saveStoredVisibleCompetitions saves and getStoredVisibleCompetitions reads back", () => {
    const list = ["liga-f", "primera-division"];
    saveStoredVisibleCompetitions(list);
    expect(getStoredVisibleCompetitions()).toEqual(list);
  });

  // SPEC-057 CA-5 (F-1): a blocked storage (the getter itself throws) never
  // escapes: reads give null (all visible) and writes are a no-op.
  it("with localStorage blocked, reading gives null and writing does not throw", () => {
    const blocked = { dispatchEvent: vi.fn() };
    Object.defineProperty(blocked, "localStorage", {
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
    vi.stubGlobal("window", blocked);
    expect(() => getStoredVisibleCompetitions()).not.toThrow();
    expect(getStoredVisibleCompetitions()).toBeNull();
    expect(() => saveStoredVisibleCompetitions(["liga-f"])).not.toThrow();
  });

  it("with setItem throwing (quota), writing does not throw", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: vi.fn(() => {
          throw new DOMException("blocked", "SecurityError");
        }),
        setItem: vi.fn(() => {
          throw new DOMException("full", "QuotaExceededError");
        }),
      },
      dispatchEvent: vi.fn(),
    });
    expect(getStoredVisibleCompetitions()).toBeNull();
    expect(() => saveStoredVisibleCompetitions(["liga-f"])).not.toThrow();
  });

  it("applyVisibleCompetitionsToDom sets data-user-hidden on unselected competitions", () => {
    const sections = [
      {
        dataset: { competition: "liga-f" },
        removeAttribute: vi.fn(),
        setAttribute: vi.fn(),
      },
      {
        dataset: { competition: "primera-division" },
        removeAttribute: vi.fn(),
        setAttribute: vi.fn(),
      },
    ];

    const fakeRoot = {
      querySelectorAll: vi.fn(() => sections),
    } as unknown as HTMLElement;

    applyVisibleCompetitionsToDom(["liga-f"], fakeRoot);

    expect(sections[0].removeAttribute).toHaveBeenCalledWith(
      "data-user-hidden",
    );
    expect(sections[0].setAttribute).not.toHaveBeenCalled();

    expect(sections[1].setAttribute).toHaveBeenCalledWith(
      "data-user-hidden",
      "true",
    );
  });
});

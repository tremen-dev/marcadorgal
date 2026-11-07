import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  it("KNOWN_COMPETITIONS includes all 8 key competitions with no hex colors", () => {
    expect(KNOWN_COMPETITIONS.length).toBe(8);
    for (const comp of KNOWN_COMPETITIONS) {
      expect(comp.colorRgb).toMatch(/^rgb\(/);
      expect(comp.colorRgb).not.toContain("#");
    }
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

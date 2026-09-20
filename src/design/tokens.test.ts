import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  COLORS,
  FAMILIES,
  FOCUS_RING_PX,
  GRID,
  HAIRLINE_PX,
  INPUT_FONT_PX,
  LIVE_DOT,
  LIVE_EDGE,
  MEASURE,
  RADIUS,
  SPACE,
  STATE_COLOR,
  type StateColorToken,
  TOUCH_TARGET_PX,
  TYPE,
} from "./tokens";

describe("CA-1 colors", () => {
  const entries = Object.entries(COLORS);

  it("has exactly the 17 keys of the spec", () => {
    expect(Object.keys(COLORS)).toEqual([
      "bg",
      "bgElevated",
      "bgStep",
      "line",
      "lineStrong",
      "fg",
      "fgMuted",
      "fgDim",
      "brand",
      "brandDeep",
      "brandInk",
      "ember",
      "amber",
      "red",
      "bgSubtle",
      "bgLive",
      "lineRow",
    ]);
  });

  it("declares the three colours the artboards use without a token", () => {
    const artboards = ["Componentes", "Movil", "Main"]
      .map((name) => readFileSync(`docs/diseno/${name}.dc.html`, "utf8"))
      .join("\n")
      .toUpperCase();
    for (const [key, css] of [
      ["bgSubtle", "--bg-subtle"],
      ["bgLive", "--bg-live"],
      ["lineRow", "--line-row"],
    ] as const) {
      expect(COLORS[key].css).toBe(css);
      expect(COLORS[key].value).toMatch(/^#[0-9A-F]{6}$/);
      expect(artboards, key).toContain(COLORS[key].value);
    }
  });

  it("keeps the inherited CSS variable names of _tokens.css", () => {
    expect(COLORS.brand.css).toBe("--marca");
    expect(COLORS.ember.css).toBe("--directo");
    expect(COLORS.red.css).toBe("--alerta");
    expect(COLORS.bgElevated.css).toBe("--bg-elev");
  });

  it("repeats no value and no variable", () => {
    const values = entries.map(([, c]) => c.value.toLowerCase());
    const vars = entries.map(([, c]) => c.css);
    expect(new Set(values).size).toBe(17);
    expect(new Set(vars).size).toBe(17);
  });

  it("has no fgProv key and no --fg-prov variable", () => {
    expect(Object.keys(COLORS)).not.toContain("fgProv");
    expect(entries.map(([, c]) => c.css)).not.toContain("--fg-prov");
  });
});

describe("CA-2 state colour semantics", () => {
  it("maps live/awaiting/alert to ember/amber/red", () => {
    expect(STATE_COLOR).toEqual({
      live: "ember",
      awaiting: "amber",
      alert: "red",
    });
  });

  it("does not admit the brand as a state colour", () => {
    // @ts-expect-error brand is never a state colour (ADR-005)
    const wrong: StateColorToken = "brand";
    expect(wrong).toBe("brand");
  });
});

describe("CA-3 typography", () => {
  it("has the two families of _tokens.css", () => {
    expect(FAMILIES).toEqual({
      sans: "'Geist',ui-sans-serif,system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif",
      mono: "'Geist Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace",
    });
  });

  it("has the five roles exactly as Main.dc.html writes them", () => {
    expect(TYPE).toEqual({
      display: {
        px: 44,
        weight: 800,
        family: "sans",
        leading: 1,
        tracking: "-0.045em",
      },
      score: { px: 20, weight: 600, family: "mono", leading: 1 },
      team: {
        px: 15,
        weight: 500,
        family: "sans",
        leading: 1.2,
        tracking: "-0.01em",
      },
      status: { px: 13, weight: 600, family: "mono", leading: 1 },
      eyebrow: {
        px: 11,
        weight: 600,
        family: "mono",
        leading: 1,
        tracking: "0.15em",
        uppercase: true,
      },
    });
  });
});

describe("CA-4 scales and measures", () => {
  it("SPACE", () => {
    expect(SPACE).toEqual([4, 8, 12, 16, 24, 32, 48]);
  });
  it("RADIUS", () => {
    expect(RADIUS).toEqual({ sm: 8, md: 10, lg: 14, pill: 999 });
  });
  it("MEASURE", () => {
    expect(MEASURE).toEqual({
      barDesktopTop: 56,
      barDesktopFilter: 44,
      barMobileHeader: 52,
      barMobileDays: 40,
      barMobileSegment: 42,
      barMobileBottom: 60,
      rowWide: 52,
      rowCompact: 30,
      sidebar: 236,
      panel: 372,
    });
  });
  it("GRID", () => {
    expect(GRID).toEqual({
      rowWide: "56px minmax(0, 1fr) 52px 32px",
      rowCompact: "32px minmax(0, 1fr) 46px minmax(0, 1fr) 14px",
    });
  });
  it("LIVE_DOT and LIVE_EDGE", () => {
    expect(LIVE_DOT).toEqual({ sizePx: 6, glow: "0 0 8px" });
    expect(LIVE_EDGE).toBe("inset 2px 0 0");
  });
  it("floors", () => {
    expect(TOUCH_TARGET_PX).toBe(44);
    expect(FOCUS_RING_PX).toBe(2);
    expect(INPUT_FONT_PX).toBe(16);
    expect(HAIRLINE_PX).toBe(1);
  });
});

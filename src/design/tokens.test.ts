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
      panel: 372,
      breakpointDesktop: 1024,
      competitionColumn: 360,
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

// SPEC-023 CA-7: the desktop layout starts at 1024 px. A media query cannot
// read a custom property, so every min-width query of the screen's CSS must
// say the token's value.
describe("SPEC-023 CA-7 breakpointDesktop", () => {
  it("is 1024 px", () => {
    expect(MEASURE.breakpointDesktop).toBe(1024);
  });

  it("is the only width the Xornada CSS queries", () => {
    const css = readFileSync(
      "src/components/xornada/Xornada.module.css",
      "utf8",
    );
    // SPEC-041 CA-4: prefers-reduced-motion is no width; every width
    // query is the breakpoint.
    const queries = [...css.matchAll(/@media[^{]*/g)]
      .map((m) => m[0].trim())
      .filter((q) => q.includes("width"));
    expect(queries.length).toBeGreaterThan(0);
    for (const query of queries) {
      expect(query).toBe(`@media (min-width: ${MEASURE.breakpointDesktop}px)`);
    }
  });
});

// SPEC-040 CA-4 (H-2, H-3, H-5): from breakpointDesktop, no sidebar; one
// competition per 360 px column, 16 px apart, inside 16 px of padding.
describe("SPEC-040 CA-4 desktop columns", () => {
  const css = readFileSync("src/components/xornada/Xornada.module.css", "utf8");
  const column = MEASURE.competitionColumn;
  const gap = SPACE[3];

  it("the token is 360 and the sidebar's is gone", () => {
    expect(column).toBe(360);
    expect(MEASURE).not.toHaveProperty("sidebar");
  });

  it("n columns need 360·n + 16·(n − 1) + 32 px", () => {
    const columnsAt = (width: number) =>
      Math.floor((width - 2 * gap + gap) / (column + gap));
    expect(
      [1024, 1143, 1144, 1519, 1520, 1895, 1896, 2200].map(columnsAt),
    ).toEqual([2, 2, 3, 3, 4, 4, 5, 5]);
  });

  it("the grid fills 360 px columns with the token, aligned left", () => {
    const columns = /\.columns \{[^}]*\}/g;
    const rules = css.match(columns) ?? [];
    const grid = rules.find((r) => r.includes("grid-template-columns")) ?? "";
    expect(grid).toContain(
      "grid-template-columns: repeat(auto-fill, var(--competition-column));",
    );
    expect(grid).toContain("gap: var(--space-16);");
    expect(grid).toContain("justify-content: start;");
    expect(grid).toContain("align-items: start;");
  });

  it("no sidebar left in the CSS", () => {
    expect(css).not.toMatch(/\.sidebar|\.nav[A-Z]|sticky|--sidebar|832px/);
  });
});

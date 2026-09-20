// The one definition of the design system in code (D-8, ADR-005).
// Colours and families come from docs/diseno/_tokens.css (parity.test.ts);
// scales, roles and measures from the prose and artboards of docs/diseno/.

type Color = { readonly value: string; readonly css: `--${string}` };

export const COLORS = {
  bg: { value: "#111110", css: "--bg" },
  bgElevated: { value: "#1A1815", css: "--bg-elev" },
  bgStep: { value: "#221F1A", css: "--bg-step" },
  line: { value: "#2A2620", css: "--line" },
  lineStrong: { value: "#3D362C", css: "--line-strong" },
  fg: { value: "#F5F1EA", css: "--fg" },
  fgMuted: { value: "#A7A5A0", css: "--fg-muted" },
  fgDim: { value: "#716F6C", css: "--fg-dim" },
  brand: { value: "#56DB8F", css: "--marca" },
  brandDeep: { value: "#35C177", css: "--marca-deep" },
  brandInk: { value: "#04160C", css: "--marca-ink" },
  ember: { value: "#FF6B00", css: "--directo" },
  amber: { value: "#F0B135", css: "--amber" },
  red: { value: "#FF655A", css: "--alerta" },
  // In use across the artboards with no token of their own.
  bgSubtle: { value: "#131211", css: "--bg-subtle" },
  bgLive: { value: "#1E1A16", css: "--bg-live" },
  lineRow: { value: "#1D1A16", css: "--line-row" },
} as const satisfies Record<string, Color>;

export type ColorToken = keyof typeof COLORS;

export type StateSemantic = "live" | "awaiting" | "alert";
export type StateColorToken = "ember" | "amber" | "red";

// ADR-005: awaiting = aprazado, suspendido, provisional; alert = sen sinal, conflicto.
export const STATE_COLOR: Readonly<Record<StateSemantic, StateColorToken>> = {
  live: "ember",
  awaiting: "amber",
  alert: "red",
};

export const FAMILIES = {
  sans: "'Geist',ui-sans-serif,system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif",
  mono: "'Geist Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace",
} as const;

export type FamilyToken = keyof typeof FAMILIES;

export type TypeRole = {
  readonly px: number;
  readonly weight: number;
  readonly family: FamilyToken;
  readonly leading: number;
  readonly tracking?: string;
  readonly uppercase?: boolean;
};

export type TypeRoleName = "display" | "score" | "team" | "status" | "eyebrow";

export const TYPE: Readonly<Record<TypeRoleName, TypeRole>> = {
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
};

export const SPACE = [4, 8, 12, 16, 24, 32, 48] as const;

export const RADIUS = { sm: 8, md: 10, lg: 14, pill: 999 } as const;

export const MEASURE = {
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
} as const;

export const GRID = {
  rowWide: "56px minmax(0, 1fr) 52px 32px",
  rowCompact: "32px minmax(0, 1fr) 46px minmax(0, 1fr) 14px",
} as const;

export const LIVE_DOT = { sizePx: 6, glow: "0 0 8px" } as const;

export const LIVE_EDGE = "inset 2px 0 0";

export const TOUCH_TARGET_PX = 44;
export const FOCUS_RING_PX = 2;
export const INPUT_FONT_PX = 16;
export const HAIRLINE_PX = 1;

// The self-hosted faces served from public/fonts/ and declared in globals.css.
export const FACES = [
  { family: "Geist", weight: 400, file: "Geist-Regular.woff2" },
  { family: "Geist", weight: 500, file: "Geist-Medium.woff2" },
  { family: "Geist", weight: 600, file: "Geist-SemiBold.woff2" },
  { family: "Geist", weight: 800, file: "Geist-ExtraBold.woff2" },
  { family: "Geist Mono", weight: 500, file: "GeistMono-Medium.woff2" },
  { family: "Geist Mono", weight: 600, file: "GeistMono-SemiBold.woff2" },
] as const;

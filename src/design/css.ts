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
  TOUCH_TARGET_PX,
  TYPE,
} from "./tokens.ts";

export const GENERATED_HEADER =
  "/* GENERATED from tokens.ts by tools/tokens-css.mjs — do not edit */";

const kebab = (name: string): string =>
  name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

export function renderTokensCss(): string {
  const vars: [string, string][] = [];
  for (const color of Object.values(COLORS))
    vars.push([color.css, color.value]);
  for (const [name, stack] of Object.entries(FAMILIES))
    vars.push([`--${name}`, stack]);
  for (const [role, t] of Object.entries(TYPE)) {
    vars.push([
      `--font-${role}`,
      `${t.weight} ${t.px}px/${t.leading} var(--${t.family})`,
    ]);
    if (t.tracking) vars.push([`--tracking-${role}`, t.tracking]);
  }
  for (const step of SPACE) vars.push([`--space-${step}`, `${step}px`]);
  for (const [name, px] of Object.entries(RADIUS))
    vars.push([`--radius-${name}`, `${px}px`]);
  for (const [name, px] of Object.entries(MEASURE))
    vars.push([`--${kebab(name)}`, `${px}px`]);
  for (const [name, columns] of Object.entries(GRID))
    vars.push([`--grid-${kebab(name)}`, columns]);
  vars.push(["--live-dot-size", `${LIVE_DOT.sizePx}px`]);
  vars.push(["--live-dot-glow", LIVE_DOT.glow]);
  vars.push(["--live-edge", LIVE_EDGE]);
  vars.push(["--touch-target", `${TOUCH_TARGET_PX}px`]);
  vars.push(["--focus-ring", `${FOCUS_RING_PX}px`]);
  vars.push(["--input-font", `${INPUT_FONT_PX}px`]);
  vars.push(["--hairline", `${HAIRLINE_PX}px`]);

  const body = vars.map(([name, value]) => `  ${name}: ${value};`).join("\n");
  return `${GENERATED_HEADER}\n:root {\n${body}\n}\n`;
}

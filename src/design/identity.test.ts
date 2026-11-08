import { execFileSync } from "node:child_process";
import { existsSync, globSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Wordmark } from "../components/brand/Wordmark.tsx";
import { COLORS } from "./tokens.ts";

// SPEC-065 (ADR-029): the Galician sky blue as the brand, the green as the
// victory of the form guide, the drawn block of the wordmark.

const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const files = (pattern: string): string[] =>
  globSync(pattern)
    .map((file) => relative(process.cwd(), file).replaceAll("\\", "/"))
    .sort();

// Built from pieces so that this file never matches its own searches.
const OLD_GREENS = ["56" + "DB8F", "35" + "C177", "04" + "160C"];
const GLYPH = String.fromCodePoint(0x25ae);
const VICTORY_VAR = `var(--${"victoria"})`;
// No hex literal outside tokens.ts/tokens.css (no-hex.test.ts).
const hex = (digits: string): string => `#${digits}`;

describe("SPEC-065 CA-1 tokens", () => {
  it("the brand is the sky blue of ADR-029", () => {
    expect(COLORS.brand.value).toBe(hex("0099CC"));
    expect(COLORS.brandDeep.value).toBe(hex("3A93BA"));
    expect(COLORS.brandInk.value).toBe(hex("00151F"));
  });

  it("victory is a semantic token of its own, --victoria", () => {
    expect(COLORS.victory).toEqual({ value: hex("4CC38A"), css: "--victoria" });
  });

  const surfaces = [
    "bg",
    "bgElevated",
    "bgStep",
    "bgLive",
    "bgSubtle",
  ] as const;

  it.each(
    surfaces.flatMap((s) => [
      ["brand", s],
      ["brandDeep", s],
    ]),
  )("%s on %s is at least 4.5:1", (fg, bg) => {
    const ratio = contrast(
      COLORS[fg as "brand" | "brandDeep"].value,
      COLORS[bg as (typeof surfaces)[number]].value,
    );
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("brandInk on brand is at least 4.5:1", () => {
    expect(
      contrast(COLORS.brandInk.value, COLORS.brand.value),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("victory is at least 4.5:1 on bg and bgElevated, and bg on it 8.53:1", () => {
    expect(
      contrast(COLORS.victory.value, COLORS.bg.value),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(COLORS.victory.value, COLORS.bgElevated.value),
    ).toBeGreaterThanOrEqual(4.5);
    expect(contrast(COLORS.bg.value, COLORS.victory.value)).toBeCloseTo(
      8.53,
      2,
    );
  });

  it("fg on brand fails (2.90:1): the reason for the next rule", () => {
    expect(contrast(COLORS.fg.value, COLORS.brand.value)).toBeCloseTo(2.9, 2);
  });

  it("no CSS rule under src/ with background: var(--marca) sets color: var(--fg)", () => {
    const offenders: string[] = [];
    const sheets = files("src/**/*.css");
    expect(sheets.length).toBeGreaterThan(5);
    for (const file of sheets) {
      const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const body = m[2];
        if (
          /(^|;|\s)background(-color)?\s*:\s*var\(--marca\)\s*(;|$)/.test(
            body,
          ) &&
          /(^|;|\s)color\s*:\s*var\(--fg\)\s*(;|$)/.test(body)
        )
          offenders.push(`${file}: ${m[1].trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("tokens.css and docs/diseno/_tokens.css declare --victoria", () => {
    for (const file of ["src/design/tokens.css", "docs/diseno/_tokens.css"])
      expect(readFileSync(file, "utf8").replace(/\s/g, ""), file).toContain(
        `--victoria:${hex("4CC38A")};`,
      );
  });
});

describe("SPEC-065 CA-2 no loose green", () => {
  it("git grep of the three old greens in src, tools and public is empty", () => {
    let out = "";
    try {
      out = execFileSync(
        "git",
        [
          "grep",
          // Also outside a checkout (a `git archive` in Docker).
          "--no-index",
          "-i",
          "-E",
          OLD_GREENS.join("|"),
          "--",
          "src",
          "tools",
          "public",
        ],
        { encoding: "utf8" },
      );
    } catch (error) {
      // git grep exits 1 when nothing matches.
      expect((error as { status?: number }).status).toBe(1);
    }
    expect(out).toBe("");
  });

  it("the victory variable is used under src/ only in StandingsTable.module.css", () => {
    const users = files("src/**/*.{ts,tsx,css}").filter((file) =>
      readFileSync(file, "utf8").includes(VICTORY_VAR),
    );
    expect(users).toEqual([
      "src/components/competition/StandingsTable.module.css",
    ]);
  });

  it("no brand piece uses COLORS.victory", () => {
    const pieces = [
      "src/components/brand/Wordmark.tsx",
      "src/design/icon.ts",
      "src/design/social.ts",
      ...files("tools/**/*.{mjs,js,ts}"),
    ].filter((file) => existsSync(file));
    expect(pieces).toContain("src/components/brand/Wordmark.tsx");
    expect(pieces).toContain("src/design/icon.ts");
    for (const file of pieces)
      expect(readFileSync(file, "utf8"), file).not.toMatch(
        /COLORS\s*\.\s*victory|--victoria/,
      );
  });
});

describe("SPEC-065 CA-3 the wordmark with a drawn block", () => {
  it("no source under src/ or tools/ contains the glyph", () => {
    const offenders = files("{src,tools}/**/*.{ts,tsx,css,mjs,js}").filter(
      (file) => readFileSync(file, "utf8").includes(GLYPH),
    );
    expect(offenders).toEqual([]);
  });

  it("renders marcador, an empty aria-hidden span and gal", () => {
    const html = renderToStaticMarkup(createElement(Wordmark));
    expect(html).not.toContain(GLYPH);
    const m = html.match(/^marcador<span([^>]*)><\/span>gal$/);
    expect(m, html).not.toBeNull();
    const attrs = m?.[1] ?? "";
    expect(attrs).toContain('aria-hidden="true"');
    expect(attrs).toMatch(/class="[^"]+"/);
  });

  it("the block's class is not called .mark", () => {
    const css = readFileSync(
      "src/components/brand/Wordmark.module.css",
      "utf8",
    );
    expect(css).not.toMatch(/\.mark\b/);
    expect(
      readFileSync("src/components/brand/Wordmark.tsx", "utf8"),
    ).not.toMatch(/styles\.mark\b/);
  });

  it("XornadaHeader and Footer paint the Wordmark", () => {
    for (const file of [
      "src/components/xornada/XornadaHeader.tsx",
      "src/components/layout/Footer.tsx",
    ]) {
      const tsx = readFileSync(file, "utf8");
      expect(tsx, file).toContain("<Wordmark");
      expect(tsx, file).not.toContain("styles.mark");
      expect(tsx, file).not.toContain("brandMark");
    }
  });
});

describe("SPEC-065 CA-5 docs/diseno (ADR-029 §4)", () => {
  const DIR = "docs/diseno";
  const read = (name: string): string =>
    readFileSync(`${DIR}/${name}`, "utf8").replace(/\r\n/g, "\n");
  // The history blocks keep their original colour.
  const withoutHistory = (text: string): string =>
    text.replace(/<div data-historia[\s\S]*?<!-- \/data-historia -->/g, "");
  const oldGreen = new RegExp(`${OLD_GREENS.join("|")}|86,s*219,s*143`, "i");

  it("outside the monolith and the history blocks, no old green", () => {
    const names = files(`${DIR}/*`)
      .map((file) => file.slice(DIR.length + 1))
      .filter((name) => name !== "sistema-de-deseno-marcador-gal.html");
    expect(names).toContain("Marca.dc.html");
    expect(names).toContain("HERENCIA.md");
    const offenders = names.filter((name) =>
      oldGreen.test(withoutHistory(read(name))),
    );
    expect(offenders).toEqual([]);
  });

  it("the templates' .dc.html are what build.mjs makes of them", () => {
    const shared = read("_logic.js");
    for (const name of ["Global", "Escritorio", "Movil"])
      expect(read(`${name}.dc.html`), name).toBe(
        read(`${name}.tpl.html`).replace("  //__SHARED__", shared),
      );
  });

  it("Marca.dc.html: the drawn block and the one bar, dark and sky blue, at 72/32/16", () => {
    const html = read("Marca.dc.html");
    const current = withoutHistory(html);
    expect(current).not.toContain(GLYPH);
    expect(current).toContain("border-radius: .095em");
    const bar = 'x="18.6" y="11.175" width="10.8" height="25.65" rx="3.375"';
    for (const size of [72, 32, 16]) {
      expect(current).toContain(
        `<svg width="${size}" height="${size}" viewBox="0 0 48 48"><rect width="48" height="48" rx="11" fill="${COLORS.bg.value}"/><rect x="0.5" y="0.5" width="47" height="47" rx="10.5" fill="none" stroke="${COLORS.line.value}"/><rect ${bar} fill="${COLORS.brand.value}"/></svg>`,
      );
      expect(current).toContain(
        `<svg width="${size}" height="${size}" viewBox="0 0 48 48"><rect width="48" height="48" rx="11" fill="${COLORS.brand.value}"/><rect ${bar} fill="${COLORS.bg.value}"/></svg>`,
      );
    }
    // Seeds A, B and C are history, in their original green.
    const history = html.match(
      /<div data-historia[\s\S]*?<!-- \/data-historia -->/g,
    );
    expect(history).not.toBeNull();
    const told = (history ?? []).join("\n");
    for (const seed of ["A · Dúas liñas", "B · O bloque", "C · A matriz"])
      expect(told).toContain(seed);
    expect(told).toMatch(oldGreen);
  });

  it("HERENCIA.md records the change of 2026-11-08", () => {
    const text = read("HERENCIA.md");
    expect(text).toContain("2026-11-08");
    expect(text).toContain("ADR-029");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COLORS } from "./tokens";

// SPEC-045 CA-2 (H-2, H-3): the artboards of docs/diseno/ (D-8) draw what
// production paints since SPEC-040: no sidebar, no detail panel and no star
// on desktop, one competition per 360 px column, and the two-line margin of
// SPEC-040 CA-2 in the rows of both artboards.
const read = (name: string): string =>
  readFileSync(`docs/diseno/${name}`, "utf8").replace(/\r\n/g, "\n");

// The declarations of the first inline style that contains `marker`.
function styleWith(html: string, marker: string): Map<string, string> {
  const styles = [...html.matchAll(/style="([^"]*)"|'([^']*;)'/g)].map(
    (m) => m[1] ?? m[2],
  );
  const found = styles.find((s) => s.includes(marker));
  if (found === undefined) throw new Error(`no style with ${marker}`);
  return new Map(
    found
      .split(";")
      .map((d) => d.trim())
      .filter((d) => d.includes(":"))
      .map((d) => {
        const i = d.indexOf(":");
        return [d.slice(0, i).trim(), d.slice(i + 1).trim()] as const;
      }),
  );
}

const px = (value: string | undefined): number =>
  Number.parseFloat((value ?? "").replace("px", ""));

describe("SPEC-045 CA-2 Escritorio.dc.html", () => {
  const html = read("Escritorio.dc.html");

  it("draws no sidebar, no detail panel and no star", () => {
    for (const gone of [
      "{{ nav }}",
      "t.mine",
      "236px",
      "372px",
      "{{ sel.",
      "detailStyle",
      "fFav",
      "★",
      "☆",
    ])
      expect(html, gone).not.toContain(gone);
  });

  it("is a grid of 360 px columns, 16 px apart and in, aligned left and start; 3 fit at 1440", () => {
    const grid = styleWith(html, "grid-template-columns: repeat(auto-fill");
    expect(grid.get("display")).toBe("grid");
    expect(grid.get("grid-template-columns")).toBe("repeat(auto-fill, 360px)");
    expect(grid.get("gap")).toBe("16px");
    expect(grid.get("padding")).toBe("16px");
    expect(grid.get("justify-content")).toBe("start");
    expect(grid.get("align-items")).toBe("start");
    const artboard = styleWith(html, "height: 900px");
    expect(artboard.get("width")).toBe("1440px");
    const width = px(artboard.get("width"));
    const column = 360;
    const gap = px(grid.get("gap"));
    const pad = px(grid.get("padding"));
    expect(Math.floor((width - 2 * pad + gap) / (column + gap))).toBe(3);
  });

  it("gives every column its header: name, xornada, counter in words, arrow", () => {
    expect(html).toContain("{{ it.name }}");
    expect(html).toContain("{{ it.round }}");
    expect(html).toContain("{{ it.count }}");
    expect(html).toContain("{{ it.arrow }}");
    for (const words of ["' en xogo'", "' partidos'", "' en juego'"])
      expect(html, words).toContain(words);
  });

  it("draws the rule of CA-3: the name breaks only before « · »", () => {
    expect(html).toContain("indexOf(' · ')");
    expect(html).toContain("{{ it.tail }}");
    expect(html).toContain(
      "tailStyle: cut < 0 ? 'display:none' : 'white-space:nowrap'",
    );
    // As wide as its widest segment, as in production (SPEC-045 CA-3).
    expect(html).toContain("flex: none; width: min-content;");
  });

  it("paints the rows with the 72 px two-line margin, line 2 in mono 500 10 px/1.2", () => {
    const row = styleWith(html, "grid-template-columns:72px");
    expect(row.get("grid-template-columns")).toMatch(/^72px /);
    expect(row.get("min-height")).toBe("48px");
    const sub = styleWith(html, "height: 12px; font-family: var(--mono)");
    expect(sub.get("font-weight")).toBe("500");
    expect(sub.get("font-size")).toBe("10px");
    expect(sub.get("line-height")).toBe("1.2");
  });
});

describe("SPEC-045 CA-2 Movil.dc.html", () => {
  const html = read("Movil.dc.html");

  it("paints the rows of the xornada with the 72 px two-line margin, line 2 in mono 500 10 px/1.2", () => {
    const row = styleWith(html, "grid-template-columns:72px");
    expect(row.get("grid-template-columns")).toMatch(/^72px /);
    expect(html).toContain("{{ it.sub }}");
    const sub = styleWith(html, "height: 12px; font-family: var(--mono)");
    expect(sub.get("font-weight")).toBe("500");
    expect(sub.get("font-size")).toBe("10px");
    expect(sub.get("line-height")).toBe("1.2");
  });
});

describe("SPEC-045 CA-2 the templates rebuild the artboards", () => {
  it.each(["Global", "Escritorio", "Movil"])(
    "%s.tpl.html + _logic.js reproduce %s.dc.html byte for byte",
    (name) => {
      // The same as docs/diseno/build.mjs.
      const shared = readFileSync("docs/diseno/_logic.js", "utf8");
      const tpl = readFileSync(`docs/diseno/${name}.tpl.html`, "utf8");
      expect(tpl).toContain("//__SHARED__");
      expect(tpl.replace("  //__SHARED__", shared)).toBe(
        readFileSync(`docs/diseno/${name}.dc.html`, "utf8"),
      );
    },
  );
});

// SPEC-081 CA-8 (ADR-035): the headers of both artboards draw the motto.
describe("SPEC-081 CA-8 the motto in the artboards", () => {
  const cases = [
    { name: "Movil.dc.html", size: 16, wordmark: 18 },
    { name: "Escritorio.dc.html", size: 19, wordmark: 21 },
  ] as const;

  it.each(cases)(
    "$name: Caveat (--hand) 400 $size px, --fg at 72 %, by the wordmark",
    ({ name, size, wordmark }) => {
      const html = read(name);
      expect(html).toContain(">todo o fútbol galego</span>");
      const motto = styleWith(html, "var(--hand)");
      expect(motto.get("font-weight")).toBe("400");
      expect(px(motto.get("font-size"))).toBe(size);
      expect(motto.get("color")).toBe(COLORS.fg.value);
      expect(motto.get("opacity")).toBe(".72");
      // The wordmark and the motto share one wrapper, right after the bar.
      const brand = html.match(
        /<div style="([^"]*)">\s*<span style="font: 800 (\d+)px[^>]*>marcador[\s\S]*?<!-- SPEC-081[^>]*>\s*<span style="font-family: var\(--hand\)/,
      );
      expect(brand?.[2]).toBe(String(wordmark));
      expect(brand?.[1]).toMatch(
        name.startsWith("Movil")
          ? /flex-direction: column; align-items: flex-start; gap: 2px/
          : /align-items: baseline; gap: 10px/,
      );
    },
  );

  it("_tokens.css declares --hand and imports Caveat for the artboards", () => {
    const tokens = read("_tokens.css");
    expect(tokens).toMatch(/--hand:'Caveat',/);
    expect(tokens).toMatch(/family=Caveat:wght@400/);
  });

  it("HERENCIA.md records the change", () => {
    expect(read("HERENCIA.md")).toMatch(
      /2026-11-\d\d \(SPEC-081 CA-8, ADR-035\)/,
    );
  });
});

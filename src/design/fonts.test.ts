import { existsSync, globSync, readFileSync, statSync } from "node:fs";
import { relative } from "node:path";
import { brotliDecompressSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { FACES, FAMILIES } from "./tokens";

const globals = readFileSync("src/app/globals.css", "utf8");

type Face = { family: string; weight: number; file: string };

const declaredFaces = (): Face[] =>
  [...globals.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => {
    const body = m[1];
    return {
      family: body.match(/font-family:\s*"([^"]+)"/)?.[1] ?? "",
      weight: Number(body.match(/font-weight:\s*(\d+)/)?.[1]),
      file: body.match(/url\(\/fonts\/([^)]+)\)/)?.[1] ?? "",
    };
  });

describe("CA-7 fonts and digits", () => {
  it("FACES lists the seven self-hosted faces (ADR-035: Caveat 400)", () => {
    expect(FACES).toEqual([
      { family: "Geist", weight: 400, file: "Geist-Regular.woff2" },
      { family: "Geist", weight: 500, file: "Geist-Medium.woff2" },
      { family: "Geist", weight: 600, file: "Geist-SemiBold.woff2" },
      { family: "Geist", weight: 800, file: "Geist-ExtraBold.woff2" },
      { family: "Geist Mono", weight: 500, file: "GeistMono-Medium.woff2" },
      { family: "Geist Mono", weight: 600, file: "GeistMono-SemiBold.woff2" },
      { family: "Caveat", weight: 400, file: "Caveat-Regular.woff2" },
    ]);
  });

  it.each(FACES)(
    "$family $weight has its file in public/fonts and one @font-face",
    (face) => {
      expect(existsSync(`public/fonts/${face.file}`), face.file).toBe(true);
      const matches = declaredFaces().filter(
        (d) =>
          d.family === face.family &&
          d.weight === face.weight &&
          d.file === face.file,
      );
      expect(matches).toHaveLength(1);
    },
  );

  it("declares no @font-face outside FACES and no external @import", () => {
    expect(declaredFaces()).toHaveLength(FACES.length);
    expect(globals).not.toMatch(/@import\s+url\(/);
    expect(globals).not.toMatch(/@import\s+"https?:/);
  });

  it("every @font-face swaps", () => {
    const bodies = [...globals.matchAll(/@font-face\s*\{([^}]*)\}/g)];
    expect(bodies).toHaveLength(FACES.length);
    for (const [, body] of bodies) {
      expect(body).toMatch(/font-display:\s*swap;/);
    }
  });

  it("html uses tabular digits everywhere (ADR-005)", () => {
    expect(globals).toMatch(
      /html\s*\{[^}]*font-variant-numeric:\s*tabular-nums;/,
    );
  });

  // The `font:` shorthand resets font-variant-numeric to `normal`, so any
  // element styled with it would lose the tabular digits inherited from html.
  it("no CSS under src/ uses the font shorthand", () => {
    const files = globSync("src/**/*.css").map((f) =>
      relative(process.cwd(), f).replaceAll("\\", "/"),
    );
    expect(files).toContain("src/components/xornada/Xornada.module.css");
    const offenders = files.flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .flatMap((line, i) =>
          /^\s*font\s*:/.test(line) ? [`${file}:${i + 1}`] : [],
        ),
    );
    expect(offenders).toEqual([]);
  });
});

// The cmap of a .woff2 (WOFF2 §5): the table directory, then one Brotli
// stream with every table in directory order. cmap is never transformed.
const TAGS = "cmap head hhea hmtx maxp name OS/2 post cvt  fpgm glyf loca prep CFF  VORG EBDT EBLC gasp hdmx kern LTSH PCLT VDMX vhea vmtx BASE GDEF GPOS GSUB EBSC JSTF MATH CBDT CBLC COLR CPAL SVG  sbix acnt avar bdat bloc bsln cvar fdsc feat fmtx fvar gvar hsty just lcar mort morx opbd prop trak Zapf Silf Glat Gloc Feat Sill".match(
  /.{4}\s?/g,
)?.map((tag) => tag.slice(0, 4)) ?? [];

const woff2Cmap = (file: string): Buffer => {
  const b = readFileSync(file);
  expect(b.toString("latin1", 0, 4)).toBe("wOF2");
  const at = { p: 48 };
  const uint128 = (): number => {
    let value = 0;
    for (let i = 0; i < 5; i++) {
      const byte = b[at.p++];
      value = value * 128 + (byte & 0x7f);
      if (!(byte & 0x80)) return value;
    }
    throw new Error("bad UIntBase128");
  };
  const tables: { tag: string; length: number }[] = [];
  for (let i = 0; i < b.readUInt16BE(12); i++) {
    const flags = b[at.p++];
    let tag = TAGS[flags & 63];
    if ((flags & 63) === 63) {
      tag = b.toString("latin1", at.p, at.p + 4);
      at.p += 4;
    }
    const version = flags >> 6;
    const length = uint128();
    const transformed =
      tag === "glyf" || tag === "loca" ? version === 0 : version !== 0;
    tables.push({ tag, length: transformed ? uint128() : length });
  }
  const stream = brotliDecompressSync(
    b.subarray(at.p, at.p + b.readUInt32BE(20)),
  );
  let offset = 0;
  for (const { tag, length } of tables) {
    if (tag === "cmap") return stream.subarray(offset, offset + length);
    offset += length;
  }
  throw new Error("no cmap");
};

// Whether the Windows Unicode subtable (format 4 or 12) maps the code point.
const maps = (cmap: Buffer, codePoint: number): boolean => {
  for (let i = 0; i < cmap.readUInt16BE(2); i++) {
    const record = 4 + i * 8;
    if (cmap.readUInt16BE(record) !== 3) continue;
    const sub = cmap.readUInt32BE(record + 4);
    const format = cmap.readUInt16BE(sub);
    if (format === 12) {
      for (let g = 0; g < cmap.readUInt32BE(sub + 12); g++) {
        const group = sub + 16 + g * 12;
        if (
          cmap.readUInt32BE(group) <= codePoint &&
          codePoint <= cmap.readUInt32BE(group + 4)
        )
          return true;
      }
    }
    if (format === 4) {
      const segments = cmap.readUInt16BE(sub + 6) / 2;
      const ends = sub + 14;
      const starts = ends + segments * 2 + 2;
      const deltas = starts + segments * 2;
      const ranges = deltas + segments * 2;
      for (let s = 0; s < segments; s++) {
        const start = cmap.readUInt16BE(starts + s * 2);
        if (codePoint < start || codePoint > cmap.readUInt16BE(ends + s * 2))
          continue;
        const range = cmap.readUInt16BE(ranges + s * 2);
        if (range === 0) return true;
        const glyph = cmap.readUInt16BE(
          ranges + s * 2 + range + (codePoint - start) * 2,
        );
        return glyph !== 0;
      }
    }
  }
  return false;
};

const rootVar = (css: string, name: string): string | undefined =>
  css
    .match(/:root\s*\{([^}]*)\}/)?.[1]
    .match(new RegExp(`${name}\\s*:\\s*([^;]+);`))?.[1]
    .trim();

describe("SPEC-081 CA-1 Caveat, the hand of the motto (ADR-035)", () => {
  const caveat = "public/fonts/Caveat-Regular.woff2";

  it("is one self-hosted woff2 of 50 KB at most", () => {
    expect(statSync(caveat).size).toBeLessThanOrEqual(50 * 1024);
  });

  it("covers «ú» (U+00FA) and the rest of the motto", () => {
    const cmap = woff2Cmap(caveat);
    for (const char of "todo o fútbol galego".replaceAll(" ", "")) {
      expect(maps(cmap, char.codePointAt(0) ?? 0), char).toBe(true);
    }
    // The reader is not trivially true: Caveat has no CJK.
    expect(maps(cmap, 0x4e2d)).toBe(false);
  });

  it("ships its OFL licence next to the file", () => {
    const licence = readFileSync("public/fonts/Caveat-OFL.txt", "utf8");
    expect(licence).toMatch(/The Caveat Project Authors/);
    expect(licence).toMatch(/SIL Open Font License, Version 1\.1/);
  });

  it("FAMILIES.hand is --hand of docs/diseno/_tokens.css: Caveat, then Geist's stack", () => {
    const system = readFileSync("docs/diseno/_tokens.css", "utf8");
    const normalize = (v: string) => v.replace(/["'\s]/g, "").toLowerCase();
    expect(normalize(rootVar(system, "--hand") ?? "")).toBe(
      normalize(FAMILIES.hand),
    );
    expect(FAMILIES.hand).toBe(`'Caveat',${FAMILIES.sans}`);
  });

  it("nothing under src/ asks Google for fonts", () => {
    const offenders = globSync("src/**/*.{ts,tsx,css,mjs,js,json}")
      .map((f) => relative(process.cwd(), f).replaceAll("\\", "/"))
      .filter((file) => file !== "src/design/fonts.test.ts")
      .filter((file) =>
        /fonts\.(googleapis|gstatic)\.com/.test(readFileSync(file, "utf8")),
      );
    expect(offenders).toEqual([]);
  });
});

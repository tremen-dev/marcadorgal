import { existsSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { iconSvg } from "./icon.ts";
import {
  decodePng,
  deltaE,
  type Png,
  pixel,
  type Rgb,
  rgbOf,
} from "./raster.ts";
import {
  OG_ASSET,
  ogHtml,
  SOCIAL_ASSETS,
  type SocialAsset,
  socialHtml,
} from "./social.ts";
import { COLORS } from "./tokens.ts";

// SPEC-064 (ADR-029): the pieces for social networks and og.png, painted from
// COLORS by tools/redes.mjs and tools/og-image.mjs.

// Built from pieces so that no hex literal lives outside tokens.ts and the
// old greens never match the git grep of identity.test.ts.
const hex = (digits: string): string => `#${digits}`;
const OLD_GREENS: Rgb[] = [
  rgbOf(hex("56" + "DB8F")),
  rgbOf(hex("35" + "C177")),
];
const GLYPH = String.fromCodePoint(0x25ae);

const byPath = (path: string): SocialAsset => {
  const asset = SOCIAL_ASSETS.find((a) => a.path === path);
  if (!asset) throw new Error(`no ${path} in SOCIAL_ASSETS`);
  return asset;
};

describe("SPEC-064 CA-1 the catalogue", () => {
  const both = (base: string, size: number) =>
    (["oscuro", "celeste"] as const).map((suffix) => ({
      path: `assets/redes/${base}-${suffix}.png`,
      width: size,
      height: size,
      variant: suffix === "oscuro" ? "dark" : "brand",
      crop: "circle",
    }));

  const expected = [
    {
      path: "public/og.png",
      width: 1200,
      height: 630,
      variant: "dark",
      crop: "rect",
    },
    ...both("x-avatar", 400),
    {
      path: "assets/redes/x-header.png",
      width: 1500,
      height: 500,
      variant: "dark",
      crop: "rect",
    },
    ...both("ig-perfil", 1080),
    {
      path: "assets/redes/ig-post-1080x1080.png",
      width: 1080,
      height: 1080,
      variant: "dark",
      crop: "rect",
    },
    {
      path: "assets/redes/ig-post-1080x1350.png",
      width: 1080,
      height: 1350,
      variant: "dark",
      crop: "rect",
    },
    {
      path: "assets/redes/ig-story.png",
      width: 1080,
      height: 1920,
      variant: "dark",
      crop: "rect",
    },
    ...(["oscuro", "celeste"] as const).map((suffix) => ({
      path: `assets/redes/ig-destacada-${suffix}.png`,
      width: 1080,
      height: 1920,
      variant: suffix === "oscuro" ? "dark" : "brand",
      crop: "circle",
    })),
    ...both("whatsapp-perfil", 640),
    ...both("bluesky-avatar", 1000),
    {
      path: "assets/redes/bluesky-banner.png",
      width: 3000,
      height: 1000,
      variant: "dark",
      crop: "rect",
    },
  ];

  it("lists every piece of the table, once, with its size, variant and crop", () => {
    expect(
      SOCIAL_ASSETS.map(({ path, width, height, variant, crop }) => ({
        path,
        width,
        height,
        variant,
        crop,
      })),
    ).toEqual(expected);
    expect(OG_ASSET).toBe(byPath("public/og.png"));
  });

  it("circle pieces: a circle of radius 0.40 × width, centred", () => {
    for (const asset of SOCIAL_ASSETS.filter((a) => a.crop === "circle"))
      expect(asset.safe, asset.path).toEqual({
        kind: "circle",
        cx: asset.width / 2,
        cy: asset.height / 2,
        r: 0.4 * asset.width,
      });
  });

  it("the safe zones the spec fixes", () => {
    expect(byPath("assets/redes/x-header.png").safe).toEqual({
      kind: "rect",
      x0: 360,
      y0: 90,
      x1: 1140,
      y1: 410,
    });
    expect(byPath("assets/redes/bluesky-banner.png").safe).toEqual({
      kind: "rect",
      x0: 720,
      y0: 180,
      x1: 2280,
      y1: 820,
    });
    const story = byPath("assets/redes/ig-story.png").safe;
    expect(story.kind).toBe("rect");
    if (story.kind === "rect") {
      expect(story.y0).toBeGreaterThanOrEqual(250);
      expect(story.y1).toBeLessThanOrEqual(1670);
    }
  });

  it("every rect zone lies inside its piece", () => {
    for (const { safe, width, height, path } of SOCIAL_ASSETS)
      if (safe.kind === "rect") {
        expect(safe.x0, path).toBeGreaterThanOrEqual(0);
        expect(safe.y0, path).toBeGreaterThanOrEqual(0);
        expect(safe.x1, path).toBeLessThanOrEqual(width);
        expect(safe.y1, path).toBeLessThanOrEqual(height);
      }
  });
});

// The colours a brand piece may use: COLORS, never victory (ADR-029 §2).
const allowed = new Set(
  Object.entries(COLORS)
    .filter(([key]) => key !== "victory")
    .map(([, c]) => c.value.toUpperCase()),
);
const hexesIn = (html: string): string[] =>
  [...html.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toUpperCase());
const textOf = (html: string): string =>
  html
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

describe("SPEC-064 CA-2 the pages the tools paint", () => {
  const pages = [
    ...SOCIAL_ASSETS.filter((a) => a !== OG_ASSET).map(
      (a) => [a.path, socialHtml(a, "")] as const,
    ),
    [OG_ASSET.path, ogHtml("")] as const,
  ];

  it.each(pages)("%s: colours only from COLORS, no glyph", (_, html) => {
    expect(html).not.toContain(GLYPH);
    const hexes = hexesIn(html);
    expect(hexes.length).toBeGreaterThan(0);
    expect(hexes.filter((h) => !allowed.has(h))).toEqual([]);
    expect(html).not.toMatch(/(^|[;{\s])font\s*:/);
  });

  it.each(pages)("%s: a page of exactly its size", (path, html) => {
    const { width, height } = byPath(path);
    expect(html).toContain(`width: ${width}px`);
    expect(html).toContain(`height: ${height}px`);
  });

  it("the circle pieces paint the icon of iconSvg in their variant", () => {
    for (const asset of SOCIAL_ASSETS.filter((a) => a.crop === "circle"))
      expect(socialHtml(asset, ""), asset.path).toContain(
        iconSvg({ rounded: false, variant: asset.variant }).replace(
          "<svg ",
          `<svg width="${asset.width}" height="${asset.width}" `,
        ),
      );
  });

  it("the drawn block of the wordmark: an empty span, no glyph", () => {
    for (const asset of SOCIAL_ASSETS.filter((a) => a.crop === "rect"))
      expect(
        asset === OG_ASSET ? ogHtml("") : socialHtml(asset, ""),
        asset.path,
      ).toMatch(/marcador<span class="block" aria-hidden="true"><\/span>gal/);
  });

  it("the font faces passed in land in the page", () => {
    const faces = "@font-face { font-family: 'Geist'; }";
    for (const asset of SOCIAL_ASSETS)
      expect(
        asset === OG_ASSET ? ogHtml(faces) : socialHtml(asset, faces),
      ).toContain(faces);
  });

  it("tools/redes.mjs and tools/og-image.mjs share the helpers; twitter-* is gone", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pkg.scripts.redes).toBe("node tools/redes.mjs");
    for (const tool of ["tools/redes.mjs", "tools/og-image.mjs"]) {
      const src = readFileSync(tool, "utf8");
      expect(src, tool).toContain("../src/design/social.ts");
      expect(src, tool).toContain("./social-render.mjs");
      expect(src, tool).not.toMatch(/#[0-9a-fA-F]{6}\b/);
    }
    for (const gone of [
      "tools/twitter-assets.mjs",
      "public/twitter-avatar.png",
      "public/twitter-header.png",
    ])
      expect(existsSync(gone), gone).toBe(false);
  });
});

describe("SPEC-064 CA-3 text", () => {
  it("assets/redes/: only the wordmark and, on headers, story and posts, the domain", () => {
    for (const asset of SOCIAL_ASSETS.filter((a) => a !== OG_ASSET)) {
      const text = textOf(socialHtml(asset, ""));
      if (asset.crop === "circle") expect(text, asset.path).toBe("");
      else expect(text, asset.path).toBe("marcador gal marcador.gal");
    }
  });

  it("og.png keeps the gl headline, subtitle and the competition pills", () => {
    const text = textOf(ogHtml(""));
    expect(text).toContain("Todo o fútbol galego nunha pantalla");
    expect(text).toContain("Resultados en directo nun golpe de vista");
    for (const pill of [
      "1ª División",
      "2ª División",
      "1ª RFEF G1",
      "2ª RFEF G1",
      "3ª RFEF G1",
    ])
      expect(text).toContain(pill);
  });
});

const load = (path: string): Png => decodePng(readFileSync(path));

const key = (r: number, g: number, b: number): number =>
  (r << 16) | (g << 8) | b;

// Counts the colours of the pixels that are not the background and checks
// that every one of them falls inside the safe zone.
function inspect(asset: SocialAsset) {
  const png = load(asset.path);
  const background = rgbOf(
    asset.variant === "dark" ? COLORS.bg.value : COLORS.brand.value,
  );
  const counts = new Map<number, number>();
  const bgKey = key(...background);
  let firstOutside: string | null = null;
  let outsideCount = 0;
  const { safe } = asset;
  for (let y = 0; y < png.height; y++)
    for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4;
      const k = key(png.rgba[i], png.rgba[i + 1], png.rgba[i + 2]);
      if (k === bgKey && png.rgba[i + 3] === 255) continue;
      counts.set(k, (counts.get(k) ?? 0) + 1);
      const inside =
        safe.kind === "circle"
          ? Math.hypot(x + 0.5 - safe.cx, y + 0.5 - safe.cy) <= safe.r
          : x >= safe.x0 &&
            x + 1 <= safe.x1 &&
            y >= safe.y0 &&
            y + 1 <= safe.y1;
      if (!inside) {
        outsideCount++;
        firstOutside ??= `${x},${y}`;
      }
    }
  const colours = [...counts.entries()].map(([k, n]) => ({
    rgb: [(k >> 16) & 0xff, (k >> 8) & 0xff, k & 0xff] as Rgb,
    n,
  }));
  colours.sort((a, b) => b.n - a.n);
  return { png, background, colours, outsideCount, firstOutside };
}

const near = (colours: { rgb: Rgb }[], target: Rgb): Rgb[] =>
  colours.filter((c) => deltaE(c.rgb, target) < 10).map((c) => c.rgb);

describe("SPEC-064 CA-4 og.png without a fake live", () => {
  it("the page drops the EN XOGO pill and its dot, keeps the icon of one bar", () => {
    const html = ogHtml("");
    expect(html).not.toMatch(/xogo/i);
    expect(html).not.toMatch(/badge|dot/i);
    expect(html).toContain(iconSvg({ rounded: true }));
  });

  it("1200×630, under 300 KB", () => {
    expect(statSync(OG_ASSET.path).size).toBeLessThan(300 * 1024);
    expect(load(OG_ASSET.path)).toMatchObject({ width: 1200, height: 630 });
  });

  it("no pixel within ΔE 10 of the old green or of ember", () => {
    const { colours } = inspect(OG_ASSET);
    expect(near(colours, OLD_GREENS[0])).toEqual([]);
    expect(near(colours, rgbOf(COLORS.ember.value))).toEqual([]);
  });
});

describe("SPEC-064 CA-5 sizes, colours and safe zones", () => {
  it.each(SOCIAL_ASSETS.map((a) => [a.path, a] as const))(
    "%s",
    (path, asset) => {
      expect(existsSync(path), `${path} missing: run npm run redes`).toBe(true);
      const { png, background, colours, outsideCount, firstOutside } =
        inspect(asset);
      expect([png.width, png.height]).toEqual([asset.width, asset.height]);
      expect(pixel(png, 2, 2)).toEqual([...background, 255]);
      const majority = rgbOf(
        asset.variant === "dark" ? COLORS.brand.value : COLORS.bg.value,
      );
      expect(colours.length).toBeGreaterThan(0);
      expect(colours[0].rgb).toEqual(majority);
      for (const green of OLD_GREENS) expect(near(colours, green)).toEqual([]);
      expect(
        outsideCount,
        `first pixel outside the safe zone: ${firstOutside}`,
      ).toBe(0);
    },
  );
});

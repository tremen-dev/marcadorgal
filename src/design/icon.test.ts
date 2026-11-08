import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { ICON_FILES, iconSvg } from "./icon.ts";
import { COLORS } from "./tokens.ts";

// SPEC-063 CA-4 (ADR-028 §4): one bar in COLORS, rasterised into public/ by
// tools/icons.mjs (`node tools/icons.mjs`), same files as SPEC-033 CA-6.

type Png = { width: number; height: number; rgba: Uint8Array };

// A minimal decoder for the 8-bit RGB or RGBA, non-interlaced PNGs the
// tool writes; the result is always RGBA.
function decodePng(buf: Buffer): Png {
  expect(buf.subarray(1, 4).toString("latin1")).toBe("PNG");
  let offset = 8;
  let width = 0;
  let height = 0;
  let bpp = 4;
  const idat: Buffer[] = [];
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString("latin1");
    const data = buf.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      expect([data[8], data[12]]).toEqual([8, 0]);
      expect([2, 6]).toContain(data[9]);
      bpp = data[9] === 6 ? 4 : 3;
    }
    if (type === "IDAT") idat.push(data);
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const out = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      const predictor = [0, a, b, (a + b) >> 1, paeth][filter];
      out[y * stride + x] = (v + predictor) & 0xff;
    }
  }
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    for (let k = 0; k < 3; k++) rgba[i * 4 + k] = out[i * bpp + k];
    rgba[i * 4 + 3] = bpp === 4 ? out[i * bpp + 3] : 255;
  }
  return { width, height, rgba };
}

const read = (path: string): Buffer => readFileSync(`public/${path}`);

const rgbOf = (value: string): number[] =>
  [1, 3, 5].map((i) => Number.parseInt(value.slice(i, i + 2), 16));

const pixel = (png: Png, x: number, y: number): number[] => {
  const i = (y * png.width + x) * 4;
  return [...png.rgba.subarray(i, i + 4)];
};

const BAR = 'x="18.6" y="11.175" width="10.8" height="25.65" rx="3.375"';

describe("SPEC-063 CA-4 the icon: one bar", () => {
  it("dark (default): the bg tile and one bar in the brand", () => {
    const svg = iconSvg({ rounded: true });
    expect(svg).toBe(iconSvg({ rounded: true, variant: "dark" }));
    expect(svg).toContain('viewBox="0 0 48 48"');
    expect(svg).toContain(`rx="11" fill="${COLORS.bg.value}"`);
    expect(svg).toContain(`stroke="${COLORS.line.value}"`);
    expect(svg.match(/<rect /g)).toHaveLength(3);
    expect(svg.split(BAR)).toHaveLength(2);
    expect(svg).toContain(`${BAR} fill="${COLORS.brand.value}"`);
    expect(svg).not.toContain(COLORS.fg.value);
    const square = iconSvg({ rounded: false });
    expect(square).not.toContain('rx="11"');
    expect(square.match(/<rect /g)).toHaveLength(2);
  });

  it("brand: the bar in bg on a brand tile", () => {
    const svg = iconSvg({ rounded: false, variant: "brand" });
    expect(svg).toContain(
      `<rect width="48" height="48" fill="${COLORS.brand.value}"/>`,
    );
    expect(svg.split(BAR)).toHaveLength(2);
    expect(svg).toContain(`${BAR} fill="${COLORS.bg.value}"`);
  });

  it("icon-32.png and apple-touch-icon.png have their sizes", () => {
    expect(decodePng(read(ICON_FILES.icon.path))).toMatchObject({
      width: 32,
      height: 32,
    });
    expect(decodePng(read(ICON_FILES.apple.path))).toMatchObject({
      width: 180,
      height: 180,
    });
  });

  it("PWA icons icon-192.png and icon-512.png have their sizes", () => {
    expect(decodePng(read(ICON_FILES.pwa192.path))).toMatchObject({
      width: 192,
      height: 192,
    });
    expect(decodePng(read(ICON_FILES.pwa512.path))).toMatchObject({
      width: 512,
      height: 512,
    });
  });

  it("favicon.ico carries a 16 and a 32 px PNG", () => {
    const ico = read(ICON_FILES.favicon.path);
    expect([ico.readUInt16LE(0), ico.readUInt16LE(2)]).toEqual([0, 1]);
    const count = ico.readUInt16LE(4);
    expect(count).toBe(2);
    const sizes: number[] = [];
    for (let i = 0; i < count; i++) {
      const entry = 6 + i * 16;
      const size = ico.readUInt32LE(entry + 8);
      const at = ico.readUInt32LE(entry + 12);
      const png = decodePng(ico.subarray(at, at + size));
      expect(png.width).toBe(ico[entry] || 256);
      expect(png.height).toBe(png.width);
      sizes.push(png.width);
    }
    expect(sizes).toEqual([16, 32]);
  });

  it("apple-touch-icon.png: the centre is --marca, the corners --bg, no --fg left", () => {
    const png = decodePng(read(ICON_FILES.apple.path));
    const bg = [...rgbOf(COLORS.bg.value), 255];
    for (const [x, y] of [
      [2, 2],
      [177, 2],
      [2, 177],
      [177, 177],
    ])
      expect(pixel(png, x, y), `${x},${y}`).toEqual(bg);
    expect(pixel(png, 90, 90)).toEqual([...rgbOf(COLORS.brand.value), 255]);
    const fg = rgbOf(COLORS.fg.value);
    let fgPixels = 0;
    for (let y = 0; y < png.height; y++)
      for (let x = 0; x < png.width; x++) {
        const [r, g, b] = pixel(png, x, y);
        if (r === fg[0] && g === fg[1] && b === fg[2]) fgPixels++;
      }
    expect(fgPixels).toBe(0);
  });

  it("the rounded tile leaves its corners transparent (icon-32.png)", () => {
    const png = decodePng(read(ICON_FILES.icon.path));
    expect(pixel(png, 0, 0)[3]).toBe(0);
    expect(pixel(png, 16, 2)).toEqual([...rgbOf(COLORS.bg.value), 255]);
  });
});

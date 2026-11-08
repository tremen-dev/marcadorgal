import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ICON_FILES, iconSvg } from "./icon.ts";
import { decodePng, pixel, rgbOf } from "./raster.ts";
import { COLORS } from "./tokens.ts";

// SPEC-063 CA-4 (ADR-028 §4): one bar in COLORS, rasterised into public/ by
// tools/icons.mjs (`node tools/icons.mjs`), same files as SPEC-033 CA-6.

const read = (path: string): Buffer => readFileSync(`public/${path}`);

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

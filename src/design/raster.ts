import { inflateSync } from "node:zlib";

// Test support for the rasterised design pieces (icons, og.png, the social
// assets): a minimal PNG decoder and a colour distance. Not imported by the
// app.

export type Png = { width: number; height: number; rgba: Uint8Array };

// Decodes the 8-bit RGB or RGBA, non-interlaced PNGs that Chromium writes;
// the result is always RGBA.
export function decodePng(buf: Uint8Array): Png {
  const view = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  if (view.subarray(1, 4).toString("latin1") !== "PNG")
    throw new Error("not a PNG");
  let offset = 8;
  let width = 0;
  let height = 0;
  let bpp = 4;
  const idat: Buffer[] = [];
  while (offset < view.length) {
    const length = view.readUInt32BE(offset);
    const type = view.subarray(offset + 4, offset + 8).toString("latin1");
    const data = view.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[12] !== 0)
        throw new Error("only 8-bit, non-interlaced PNGs");
      if (data[9] !== 2 && data[9] !== 6)
        throw new Error("only RGB or RGBA PNGs");
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
      let predictor = 0;
      if (filter === 1) predictor = a;
      else if (filter === 2) predictor = b;
      else if (filter === 3) predictor = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        predictor = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
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

export type Rgb = readonly [number, number, number];

export const rgbOf = (hex: string): Rgb => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
];

export const pixel = (png: Png, x: number, y: number): number[] => {
  const i = (y * png.width + x) * 4;
  return [...png.rgba.subarray(i, i + 4)];
};

// sRGB (D65) to CIELAB.
function lab([r, g, b]: Rgb): [number, number, number] {
  const lin = (v: number): number => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t: number): number =>
    t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116;
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

// CIE76 ΔE: the Euclidean distance in CIELAB.
export function deltaE(a: Rgb, b: Rgb): number {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

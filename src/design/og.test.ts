import { existsSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("SPEC-050 CA-3 public/og.png", () => {
  const path = "public/og.png";

  it("exists in public/", () => {
    expect(existsSync(path)).toBe(true);
  });

  it("is a valid PNG file with exact dimensions 1200x630", () => {
    const buf = readFileSync(path);
    // PNG signature: \x89 P N G \r \n \x1a \n
    expect(buf[0]).toBe(0x89);
    expect(buf.subarray(1, 4).toString("latin1")).toBe("PNG");

    // IHDR starts at byte 12; width at 16, height at 20
    const ihdrType = buf.subarray(12, 16).toString("latin1");
    expect(ihdrType).toBe("IHDR");

    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    expect(width).toBe(1200);
    expect(height).toBe(630);
  });

  it("is lightweight and well under WhatsApp 300 KB limit", () => {
    const { size } = statSync(path);
    expect(size).toBeGreaterThan(10 * 1024);
    expect(size).toBeLessThan(300 * 1024);
  });
});

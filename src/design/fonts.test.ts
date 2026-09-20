import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FACES } from "./tokens";

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
  it("FACES lists the six self-hosted faces", () => {
    expect(FACES).toEqual([
      { family: "Geist", weight: 400, file: "Geist-Regular.woff2" },
      { family: "Geist", weight: 500, file: "Geist-Medium.woff2" },
      { family: "Geist", weight: 600, file: "Geist-SemiBold.woff2" },
      { family: "Geist", weight: 800, file: "Geist-ExtraBold.woff2" },
      { family: "Geist Mono", weight: 500, file: "GeistMono-Medium.woff2" },
      { family: "Geist Mono", weight: 600, file: "GeistMono-SemiBold.woff2" },
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

  it("html uses tabular digits everywhere (ADR-005)", () => {
    expect(globals).toMatch(
      /html\s*\{[^}]*font-variant-numeric:\s*tabular-nums;/,
    );
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";

// Test support (SPEC-031 CA-1): the real captures of fixtures/, as the text
// TextDecoder("iso-8859-15") gives for the bytes the server sent. `.raw` holds
// those bytes; `.html` is a capture that was only kept as UTF-8 text (README).
// Only tests import this module; the adapter never reads files.

export type Fixture = {
  name: string;
  file: string;
  // When the panel was captured (UTC), from the server `Date` or the README.
  capturedAt: string;
};

export const FIXTURES: readonly Fixture[] = [
  {
    name: "paneles-masculino",
    file: "paneles-masculino.html",
    capturedAt: "2026-10-10T20:49:00Z",
  },
  {
    name: "paneles-femenino-fed3",
    file: "paneles-femenino-fed3.html",
    capturedAt: "2026-10-10T20:49:00Z",
  },
  {
    name: "paneles-masculino-enjuego-2026-10-10T21-25-32Z",
    file: "paneles-masculino-enjuego-2026-10-10T21-25-32Z.raw",
    capturedAt: "2026-10-10T21:25:32Z",
  },
  {
    name: "paneles-masculino-fed3-2026-10-10T21-25-36Z",
    file: "paneles-masculino-fed3-2026-10-10T21-25-36Z.raw",
    capturedAt: "2026-10-10T21:25:36Z",
  },
  {
    name: "paneles-fed3-enjuego-GET-hacia-2026-10-10T21-28Z",
    file: "paneles-fed3-enjuego-GET-hacia-2026-10-10T21-28Z.raw",
    capturedAt: "2026-10-10T21:28:00Z",
  },
  {
    name: "paneles-fed3-enjuego-2026-10-10T21-33-30Z",
    file: "paneles-fed3-enjuego-2026-10-10T21-33-30Z.raw",
    capturedAt: "2026-10-10T21:33:30Z",
  },
  {
    name: "paneles-fed3-enjuego-2026-10-10T21-40-32Z",
    file: "paneles-fed3-enjuego-2026-10-10T21-40-32Z.raw",
    capturedAt: "2026-10-10T21:40:32Z",
  },
  {
    name: "paneles-fed3-enjuego-2026-10-10T21-47-34Z",
    file: "paneles-fed3-enjuego-2026-10-10T21-47-34Z.raw",
    capturedAt: "2026-10-10T21:47:34Z",
  },
];

// __dirname, not import.meta: Playwright loads this module as CommonJS (CA-3).
const dir = path.join(__dirname, "fixtures");

export function fixtureBytes(file: string): Uint8Array {
  return readFileSync(path.join(dir, file));
}

export function fixtureText(name: string): string {
  const f = FIXTURES.find((x) => x.name === name);
  if (f === undefined) throw new Error(`no fixture ${name}`);
  const bytes = fixtureBytes(f.file);
  return f.file.endsWith(".raw")
    ? new TextDecoder("iso-8859-15").decode(bytes)
    : new TextDecoder("utf-8").decode(bytes);
}

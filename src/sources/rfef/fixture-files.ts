import { readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

// Test support (SPEC-031 CA-1): the real captures of fixtures/, as the text
// TextDecoder("iso-8859-15") gives for the bytes the server sent. `.raw` holds
// those bytes; `.html` is a capture that was only kept as UTF-8 text (README).
// Only tests import this module; the adapter never reads files.

export type Fixture = {
  name: string;
  file: string;
  // sondeo: GET of 2026-10-10, possibly cached (E-1). campo: POST series of
  // 2026-10-11 (ADR-018), fresh.
  origin: "sondeo" | "campo";
  method: "GET" | "POST";
  // When the panel was captured (UTC), from the server `Date` or the README.
  capturedAt: string;
};

export const FIXTURES: readonly Fixture[] = [
  {
    name: "paneles-masculino",
    file: "paneles-masculino.html",
    origin: "sondeo",
    method: "GET",
    capturedAt: "2026-10-10T20:49:00Z",
  },
  {
    name: "paneles-femenino-fed3",
    file: "paneles-femenino-fed3.html",
    origin: "sondeo",
    method: "GET",
    capturedAt: "2026-10-10T20:49:00Z",
  },
  {
    name: "paneles-masculino-enjuego-2026-10-10T21-25-32Z",
    file: "paneles-masculino-enjuego-2026-10-10T21-25-32Z.raw",
    origin: "sondeo",
    method: "GET",
    capturedAt: "2026-10-10T21:25:32Z",
  },
  {
    name: "paneles-masculino-fed3-2026-10-10T21-25-36Z",
    file: "paneles-masculino-fed3-2026-10-10T21-25-36Z.raw",
    origin: "sondeo",
    method: "GET",
    capturedAt: "2026-10-10T21:25:36Z",
  },
  {
    name: "paneles-fed3-enjuego-GET-hacia-2026-10-10T21-28Z",
    file: "paneles-fed3-enjuego-GET-hacia-2026-10-10T21-28Z.raw",
    origin: "sondeo",
    method: "GET",
    capturedAt: "2026-10-10T21:28:00Z",
  },
  {
    name: "paneles-fed3-enjuego-2026-10-10T21-33-30Z",
    file: "paneles-fed3-enjuego-2026-10-10T21-33-30Z.raw",
    origin: "sondeo",
    method: "GET",
    capturedAt: "2026-10-10T21:33:30Z",
  },
  {
    name: "paneles-fed3-enjuego-2026-10-10T21-40-32Z",
    file: "paneles-fed3-enjuego-2026-10-10T21-40-32Z.raw",
    origin: "sondeo",
    method: "GET",
    capturedAt: "2026-10-10T21:40:32Z",
  },
  {
    name: "paneles-fed3-enjuego-2026-10-10T21-47-34Z",
    file: "paneles-fed3-enjuego-2026-10-10T21-47-34Z.raw",
    origin: "sondeo",
    method: "GET",
    capturedAt: "2026-10-10T21:47:34Z",
  },
  ...[
    "2026-10-11T15-00-15Z",
    "2026-10-11T15-02-24Z",
    "2026-10-11T15-35-05Z",
  ].map(
    (ts): Fixture => ({
      name: `campo-post-${ts}-todos`,
      file: `campo-post-${ts}-todos.raw.gz`,
      origin: "campo",
      method: "POST",
      capturedAt: ts.replace(/T(\d\d)-(\d\d)-(\d\d)Z$/, "T$1:$2:$3Z"),
    }),
  ),
];

// The POST body of the series (ADR-017 §1 query, ADR-018 §1).
export const CAMPO_REQUEST_BODY =
  "cod_primaria=3001668&grupo_categoria=900163685,900163686&resultados=1&columna=1&extendido=1&no_paginacion=1&tipo_peticion=1&federacion=3";

// A real 200 with Content-Length: 0 of the POST series (the IP block).
export const EMPTY_BODY_FILE =
  "campo-post-2026-10-11T15-12-22Z-todos-vacio.raw";

// __dirname, not import.meta: Playwright loads this module as CommonJS (CA-3).
const dir = path.join(__dirname, "fixtures");

export function fixtureBytes(file: string): Uint8Array {
  const bytes = readFileSync(path.join(dir, file));
  return file.endsWith(".gz") ? gunzipSync(bytes) : bytes;
}

export function fixtureText(name: string): string {
  const f = FIXTURES.find((x) => x.name === name);
  if (f === undefined) throw new Error(`no fixture ${name}`);
  const bytes = fixtureBytes(f.file);
  return /\.raw(\.gz)?$/.test(f.file)
    ? new TextDecoder("iso-8859-15").decode(bytes)
    : new TextDecoder("utf-8").decode(bytes);
}

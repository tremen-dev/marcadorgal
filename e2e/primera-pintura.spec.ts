import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

// SPEC-026 CA-1, CA-2, CA-4: the shell of tools/primera-pintura.mjs against
// the local `next start` of this config, never the network. The demo routes
// carry rows in their HTML; / without a reader (CI) carries none, so it is the
// failure path of CA-2: counted, not discarded.

type Json = {
  pasadas: {
    crudo: { ruta: string };
    pasada: {
      ruta: string;
      ttfbMs: number | null;
      fcpMs: number | null;
      filasEnHtml: number;
      datoEnHtml: boolean;
      filasAlFcp: boolean;
      fallo: string | null;
    };
  }[];
};

test("primera:pintura measures the local build under the «3G» profile", async ({
  baseURL,
}, testInfo) => {
  test.setTimeout(120_000);
  const salida = testInfo.outputPath("primera-pintura");
  execFileSync(
    process.execPath,
    [
      "tools/primera-pintura.mjs",
      "--url",
      String(baseURL),
      "--rutas",
      "/demo/xornada,/es/demo/xornada,/",
      "--n",
      "1",
      "--pausa",
      "0",
      "--salida",
      salida,
    ],
    { stdio: "pipe" },
  );
  const ficheros = readdirSync(salida);
  const md = ficheros.find((f) => /^primera-pintura-.+\.md$/.test(f));
  const json = ficheros.find((f) => /^primera-pintura-.+\.json$/.test(f));
  expect(md).toBeDefined();
  expect(json).toBeDefined();

  const datos = JSON.parse(
    readFileSync(path.join(salida, String(json)), "utf8"),
  ) as Json;
  const [gl, es, raiz] = datos.pasadas.map((p) => p.pasada);
  expect(datos.pasadas.map((p) => p.crudo.ruta)).toEqual([
    "/demo/xornada",
    "/es/demo/xornada",
    "/",
  ]);
  for (const p of [gl, es]) {
    expect(p.datoEnHtml).toBe(true);
    expect(p.filasEnHtml).toBeGreaterThan(0);
    expect(p.filasAlFcp).toBe(true);
    expect(p.fcpMs).toBeGreaterThan(0);
    // CA-1: the 300 ms of emulated RTT are there even against localhost.
    expect(p.ttfbMs).toBeGreaterThanOrEqual(300);
    expect(p.fallo).toBeNull();
  }
  expect(raiz.datoEnHtml).toBe(false);
  expect(raiz.fallo).toBe("sin dato en el HTML");

  const informe = readFileSync(path.join(salida, String(md)), "utf8");
  expect(informe).toContain("red 1600 kbit/s de bajada");
  expect(informe).toContain("**Veredicto: MUESTRA NO VÁLIDA**");
  expect(informe).toContain(`JSON crudo de cada pasada: \`${json}\``);
});

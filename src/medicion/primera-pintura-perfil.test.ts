import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import type { Perfil } from "./pintura";

// SPEC-026 CA-1 (H-1): the «3G» profile is one constant of the tool, and the
// tool applies it through CDP. Importing the tool runs nothing: its main is
// guarded by import.meta.main. No browser, no network.

type Herramienta = {
  PERFIL_3G: Perfil;
  opcionesContexto: (p: Perfil) => Record<string, unknown>;
  aplicaPerfil: (
    cdp: { send: (metodo: string, params?: unknown) => Promise<unknown> },
    p: Perfil,
  ) => Promise<void>;
};

const cargar = async (): Promise<Herramienta> =>
  import(
    pathToFileURL(path.resolve(__dirname, "../../tools/primera-pintura.mjs"))
      .href
  );

describe("SPEC-026 CA-1 the «3G» profile of WebPageTest, CPU ×4", () => {
  it("is fixed in tools/primera-pintura.mjs", async () => {
    const { PERFIL_3G } = await cargar();
    expect(PERFIL_3G).toEqual({
      nombre: "3G (WebPageTest)",
      bajadaKbps: 1600,
      subidaKbps: 768,
      rttMs: 300,
      cpu: 4,
      ancho: 390,
      alto: 844,
      dpr: 3,
      movil: true,
    });
  });

  it("goes to CDP in bytes per second and milliseconds", async () => {
    const { PERFIL_3G, aplicaPerfil } = await cargar();
    const llamadas: [string, unknown][] = [];
    await aplicaPerfil(
      {
        send: async (metodo, params) => {
          llamadas.push([metodo, params]);
          return {};
        },
      },
      PERFIL_3G,
    );
    expect(llamadas).toEqual([
      ["Network.enable", undefined],
      [
        "Network.emulateNetworkConditions",
        {
          offline: false,
          latency: 300,
          downloadThroughput: 200_000,
          uploadThroughput: 96_000,
        },
      ],
      ["Emulation.setCPUThrottlingRate", { rate: 4 }],
    ]);
  });

  it("a fresh mobile context of 390 × 844 at DPR 3", async () => {
    const { PERFIL_3G, opcionesContexto } = await cargar();
    expect(opcionesContexto(PERFIL_3G)).toEqual({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      serviceWorkers: "block",
    });
  });
});

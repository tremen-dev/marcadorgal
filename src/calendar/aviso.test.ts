import { describe, expect, it } from "vitest";
import {
  type Causa,
  cuerpoIncidente,
  decidirAviso,
  leerIncidente,
  type Observacion,
  observacionDeJob,
  observarSchedule,
} from "./aviso.ts";

// SPEC-075 (ADR-032): the alert of the calendar bot is one GitHub issue per
// incident. Everything here is pure: no clock, no network, no gh.
const fallo = (causa: Causa): Observacion => ({ causa, resultado: "fallo" });
const ok = (causa: Causa): Observacion => ({ causa, resultado: "ok" });

describe("SPEC-075 CA-1 decidirAviso", () => {
  const casos: {
    nombre: string;
    abiertas: Causa[] | null;
    obs: Observacion[];
    accion: string;
    causas: Causa[];
  }[] = [
    {
      nombre: "sin incidente, sin observaciones",
      abiertas: null,
      obs: [],
      accion: "nada",
      causas: [],
    },
    {
      nombre: "sin incidente, todo ok",
      abiertas: null,
      obs: [ok("sync"), ok("load")],
      accion: "nada",
      causas: [],
    },
    {
      nombre: "sin incidente, falla sync",
      abiertas: null,
      obs: [fallo("sync")],
      accion: "abrir",
      causas: ["sync"],
    },
    {
      nombre: "sin incidente, falla load",
      abiertas: null,
      obs: [ok("sync"), fallo("load")],
      accion: "abrir",
      causas: ["load"],
    },
    {
      nombre: "sin incidente, sin ejecuciones",
      abiertas: null,
      obs: [fallo("sin-ejecuciones")],
      accion: "abrir",
      causas: ["sin-ejecuciones"],
    },
    {
      nombre: "incidente sync, sync vuelve a fallar",
      abiertas: ["sync"],
      obs: [fallo("sync")],
      accion: "actualizar",
      causas: ["sync"],
    },
    {
      nombre: "incidente sync, sync ok",
      abiertas: ["sync"],
      obs: [ok("sync")],
      accion: "cerrar",
      causas: [],
    },
    {
      nombre: "incidente sync, load ok no lo cierra",
      abiertas: ["sync"],
      obs: [ok("load")],
      accion: "actualizar",
      causas: ["sync"],
    },
    {
      nombre: "incidente sync, falla load: se suma",
      abiertas: ["sync"],
      obs: [fallo("load")],
      accion: "actualizar",
      causas: ["sync", "load"],
    },
    {
      nombre: "incidente sync+load, sync ok",
      abiertas: ["sync", "load"],
      obs: [ok("sync")],
      accion: "actualizar",
      causas: ["load"],
    },
    {
      nombre: "incidente sync+load, ambos ok",
      abiertas: ["sync", "load"],
      obs: [ok("sync"), ok("load")],
      accion: "cerrar",
      causas: [],
    },
    {
      nombre: "incidente sync, sin observaciones",
      abiertas: ["sync"],
      obs: [],
      accion: "actualizar",
      causas: ["sync"],
    },
    {
      nombre: "incidente sin-ejecuciones, vigía ok",
      abiertas: ["sin-ejecuciones"],
      obs: [ok("sin-ejecuciones")],
      accion: "cerrar",
      causas: [],
    },
    {
      nombre: "incidente vacío (marcador perdido), ok",
      abiertas: [],
      obs: [ok("sync")],
      accion: "cerrar",
      causas: [],
    },
  ];

  for (const c of casos) {
    it(`${c.nombre} → ${c.accion}`, () => {
      const r = decidirAviso(
        c.abiertas === null ? null : { causas: c.abiertas },
        c.obs,
      );
      expect(r.accion).toBe(c.accion);
      expect([...r.causas].sort()).toEqual([...c.causas].sort());
    });
  }
});

describe("SPEC-075 CA-1 the machine-readable marker of the issue body", () => {
  it("round-trips causes and runs", () => {
    const body = cuerpoIncidente(
      ["sync", "load"],
      [
        "https://github.com/o/r/actions/runs/1",
        "https://github.com/o/r/actions/runs/2",
      ],
    );
    expect(body).toContain("https://github.com/o/r/actions/runs/2");
    expect(leerIncidente(body)).toEqual({
      causas: ["sync", "load"],
      ejecuciones: [
        "https://github.com/o/r/actions/runs/1",
        "https://github.com/o/r/actions/runs/2",
      ],
    });
  });

  it("a body without marker reads as no causes and no runs", () => {
    expect(leerIncidente("editado a mano")).toEqual({
      causas: [],
      ejecuciones: [],
    });
    expect(leerIncidente("<!-- bot-calendario: {roto -->")).toEqual({
      causas: [],
      ejecuciones: [],
    });
  });

  it("drops unknown causes from the marker", () => {
    const body =
      '<!-- bot-calendario: {"causas":["sync","otra"],"ejecuciones":[]} -->';
    expect(leerIncidente(body).causas).toEqual(["sync"]);
  });
});

describe("SPEC-075 CA-3 job result → observation", () => {
  it.each([
    ["failure", "fallo"],
    ["cancelled", "fallo"],
    ["success", "ok"],
  ] as const)("%s → %s", (result, resultado) => {
    expect(observacionDeJob("sync", result)).toEqual({
      causa: "sync",
      resultado,
    });
  });

  it.each(["skipped", "", undefined])("%s → no observation", (result) => {
    expect(observacionDeJob("load", result)).toBeNull();
  });
});

describe("SPEC-075 CA-4 observarSchedule", () => {
  // Saturday 2026-11-07 12:00Z.
  const sabado = "2026-11-07T12:00:00Z";
  const ejecuciones = ["2026-11-05T09:10:00Z", sabado, "2026-11-04T10:00:00Z"];

  it("Tuesday 23:00Z (83 h after) → ok", () => {
    expect(observarSchedule("2026-11-10T23:00:00Z", ejecuciones)).toEqual({
      causa: "sin-ejecuciones",
      resultado: "ok",
    });
  });

  it("Wednesday 13:00Z (97 h after) → fallo", () => {
    expect(observarSchedule("2026-11-11T13:00:00Z", ejecuciones)).toEqual({
      causa: "sin-ejecuciones",
      resultado: "fallo",
    });
  });

  it("exactly at the threshold is still ok", () => {
    expect(
      observarSchedule("2026-11-11T12:00:00Z", ejecuciones).resultado,
    ).toBe("ok");
  });

  it("no runs at all → fallo", () => {
    expect(observarSchedule("2026-11-10T23:00:00Z", []).resultado).toBe(
      "fallo",
    );
  });

  it("the threshold is a parameter", () => {
    expect(
      observarSchedule("2026-11-10T23:00:00Z", ejecuciones, 72).resultado,
    ).toBe("fallo");
  });
});

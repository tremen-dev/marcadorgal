// Alert of the calendar bot (SPEC-075, ADR-032): one GitHub issue per
// incident. This module only decides; tools/aviso-bot-calendario.mjs talks to
// gh. Pure: no clock, no network, no gh.

export const CAUSAS = ["sync", "load", "sin-ejecuciones"] as const;
export type Causa = (typeof CAUSAS)[number];

export type Observacion = { causa: Causa; resultado: "fallo" | "ok" };
export type Accion = "abrir" | "actualizar" | "cerrar" | "nada";
export type Decision = { accion: Accion; causas: Causa[] };

/** The open incident, if any, as read from its issue body. */
export type Incidente = { causas: readonly Causa[] };

/**
 * A cause with `fallo` enters the set and a cause with `ok` leaves it; causes
 * nobody observed stay as they were (a `load` ok does not close `sync`).
 */
export function decidirAviso(
  incidente: Incidente | null,
  observaciones: readonly Observacion[],
): Decision {
  const causas = new Set<Causa>(incidente?.causas ?? []);
  for (const o of observaciones) {
    if (o.resultado === "fallo") causas.add(o.causa);
    else causas.delete(o.causa);
  }
  const lista = CAUSAS.filter((c) => causas.has(c));
  if (incidente === null) {
    return lista.length > 0
      ? { accion: "abrir", causas: lista }
      : { accion: "nada", causas: [] };
  }
  return lista.length > 0
    ? { accion: "actualizar", causas: lista }
    : { accion: "cerrar", causas: [] };
}

/**
 * GitHub's `needs.<job>.result`: failure or cancelled is a failure, success is
 * ok, and a skipped job (or no result) observes nothing.
 */
export function observacionDeJob(
  causa: Causa,
  result: string | undefined,
): Observacion | null {
  if (result === "failure" || result === "cancelled") {
    return { causa, resultado: "fallo" };
  }
  if (result === "success") return { causa, resultado: "ok" };
  return null;
}

export const UMBRAL_HORAS = 96;

/**
 * The scheduled runs of calendario-semanal.yml stopped coming when the most
 * recent one (by creation, ISO-8601) is older than the threshold.
 */
export function observarSchedule(
  ahora: string,
  ejecuciones: readonly string[],
  umbralHoras: number = UMBRAL_HORAS,
): Observacion {
  const ultima = Math.max(...ejecuciones.map((e) => Date.parse(e)));
  const vieja =
    ejecuciones.length === 0 ||
    Date.parse(ahora) - ultima > umbralHoras * 3_600_000;
  return { causa: "sin-ejecuciones", resultado: vieja ? "fallo" : "ok" };
}

const MARCADOR = /<!-- bot-calendario: (.*?) -->/;

const TEXTO_CAUSA: Record<Causa, string> = {
  sync: "falla el job `sync` (sincronización con el proveedor)",
  load: "falla el job `load` (carga del calendario en la base)",
  "sin-ejecuciones":
    "las ejecuciones programadas de `calendario-semanal.yml` dejaron de llegar",
};

/** The issue body: human text plus a machine-readable marker. */
export function cuerpoIncidente(
  causas: readonly Causa[],
  ejecuciones: readonly string[],
): string {
  const datos = JSON.stringify({ causas, ejecuciones });
  return [
    "El bot del calendario (`calendario-semanal.yml`) necesita atención (SPEC-075, ADR-032).",
    "",
    "Causas abiertas:",
    ...causas.map((c) => `- ${TEXTO_CAUSA[c]}`),
    "",
    "Ejecuciones de este incidente:",
    ...ejecuciones.map((e) => `- ${e}`),
    "",
    "Este issue se edita en cada ejecución y se cierra solo cuando todas las causas vuelven a ir bien.",
    "",
    `<!-- bot-calendario: ${datos} -->`,
  ].join("\n");
}

export function leerIncidente(cuerpo: string): {
  causas: Causa[];
  ejecuciones: string[];
} {
  const m = MARCADOR.exec(cuerpo);
  if (!m) return { causas: [], ejecuciones: [] };
  try {
    const datos = JSON.parse(m[1] ?? "") as {
      causas?: unknown;
      ejecuciones?: unknown;
    };
    const causas = Array.isArray(datos.causas)
      ? CAUSAS.filter((c) => (datos.causas as unknown[]).includes(c))
      : [];
    const ejecuciones = Array.isArray(datos.ejecuciones)
      ? datos.ejecuciones.filter((e): e is string => typeof e === "string")
      : [];
    return { causas, ejecuciones };
  } catch {
    return { causas: [], ejecuciones: [] };
  }
}

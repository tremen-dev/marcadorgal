#!/usr/bin/env node
// Alert of the calendar bot (SPEC-075, ADR-032): one GitHub issue per
// incident, labelled bot-calendario and assigned to the owner. Opening and
// closing notify; every run in between only edits the body. The decision is
// pure (src/calendar/aviso.ts); this file only translates it into gh calls,
// and gh is injected so the tests never touch the network.
//
// Usage (in GitHub Actions, with GH_TOKEN and GH_REPO):
//   node tools/aviso-bot-calendario.mjs --jobs    # reads SYNC_RESULT, LOAD_RESULT
//   node tools/aviso-bot-calendario.mjs --vigia   # reads SIMULAR (no | fallo)
// Runs on Node's native type stripping: no tsx, no build step.
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  cuerpoIncidente,
  decidirAviso,
  leerIncidente,
  observacionDeJob,
  observarSchedule,
} from "../src/calendar/aviso.ts";

export const ETIQUETA = "bot-calendario";
export const TITULAR = "albertofojo";
const TITULO = "El bot del calendario está fallando";

/** URL of the current Actions run. */
export function enlaceEjecucion(env) {
  return `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`;
}

/** needs.sync.result and needs.load.result → observations (skipped: none). */
export function observacionesDeJobs(env) {
  return [
    observacionDeJob("sync", env.SYNC_RESULT),
    observacionDeJob("load", env.LOAD_RESULT),
  ].filter((o) => o !== null);
}

/** The watchman: are the scheduled runs of calendario-semanal.yml coming? */
export function observacionesVigia({ gh, ahora, simular }) {
  if (simular === "fallo") return [{ causa: "sin-ejecuciones", resultado: "fallo" }];
  const runs = JSON.parse(
    gh([
      "run",
      "list",
      "--workflow",
      "calendario-semanal.yml",
      "--event",
      "schedule",
      "--limit",
      "20",
      "--json",
      "createdAt",
    ]),
  );
  return [observarSchedule(ahora, runs.map((r) => r.createdAt))];
}

function asegurarEtiqueta(gh) {
  const etiquetas = JSON.parse(
    gh(["label", "list", "--search", ETIQUETA, "--limit", "100", "--json", "name"]),
  );
  if (etiquetas.some((e) => e.name === ETIQUETA)) return;
  gh([
    "label",
    "create",
    ETIQUETA,
    "--color",
    "B60205",
    "--description",
    "Incidente del bot del calendario (SPEC-075, ADR-032)",
  ]);
}

/** Decides and acts. Returns the action taken and the issue number, if any. */
export function avisar({ gh, observaciones, ejecucion }) {
  const abiertos = JSON.parse(
    gh([
      "issue",
      "list",
      "--label",
      ETIQUETA,
      "--state",
      "open",
      "--limit",
      "1",
      "--json",
      "number,body",
    ]),
  );
  const abierto = abiertos[0];
  const previo = abierto ? leerIncidente(abierto.body ?? "") : null;
  const { accion, causas } = decidirAviso(previo, observaciones);

  if (accion === "abrir") {
    asegurarEtiqueta(gh);
    const url = gh([
      "issue",
      "create",
      "--title",
      TITULO,
      "--label",
      ETIQUETA,
      "--assignee",
      TITULAR,
      "--body",
      cuerpoIncidente(causas, [ejecucion]),
    ]).trim();
    const numero = Number(url.split("/").pop());
    return { accion, numero: Number.isFinite(numero) ? numero : undefined };
  }
  if (accion === "actualizar") {
    const ejecuciones = [...(previo?.ejecuciones ?? []), ejecucion];
    gh([
      "issue",
      "edit",
      String(abierto.number),
      "--body",
      cuerpoIncidente(causas, ejecuciones),
    ]);
    return { accion, numero: abierto.number };
  }
  if (accion === "cerrar") {
    gh([
      "issue",
      "comment",
      String(abierto.number),
      "--body",
      `Resuelto: todas las causas vuelven a ir bien en ${ejecucion}.`,
    ]);
    gh(["issue", "close", String(abierto.number)]);
    return { accion, numero: abierto.number };
  }
  return { accion };
}

const ghReal = (args) =>
  execFileSync("gh", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });

function main(argv, env) {
  let observaciones;
  if (argv.includes("--jobs")) {
    observaciones = observacionesDeJobs(env);
  } else if (argv.includes("--vigia")) {
    observaciones = observacionesVigia({
      gh: ghReal,
      ahora: new Date().toISOString(),
      simular: env.SIMULAR,
    });
  } else {
    console.error("Uso: node tools/aviso-bot-calendario.mjs --jobs | --vigia");
    return 2;
  }
  const ejecucion = enlaceEjecucion(env);
  console.log(`Observaciones: ${JSON.stringify(observaciones)}`);
  const r = avisar({ gh: ghReal, observaciones, ejecucion });
  console.log(
    r.numero === undefined ? `Aviso: ${r.accion}` : `Aviso: ${r.accion} #${r.numero}`,
  );
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2), process.env));
}

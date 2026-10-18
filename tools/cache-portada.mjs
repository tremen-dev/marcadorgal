#!/usr/bin/env node
// SPEC-030 CA-4: does the home still serve the build's HTML after idleness?
// N rounds (5 by default) of «wait 65 s → GET / and /es without
// Accept-Encoding». Per response, one JSON line: x-vercel-cache, age, date
// and the HH:MM of the freshness line. The judgement is the pure
// src/medicion/cache-portada.ts; this file only waits, asks and writes.
//
// It only reads the public screen: no secret, no cookie, nothing written but
// its JSONL. No dependency: node:http(s), which sends no Accept-Encoding.
//
// Usage: npm run cache:portada -- [--rondas 5] [--espera 65]
//          [--url https://marcador.gal] [--salida <fichero.jsonl>]
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import {
  ESPERA_S,
  frescuraEnHtml,
  RONDAS,
  RUTAS,
  veredicto,
} from "../src/medicion/cache-portada.ts";

const QA_DIR = "docs/epicas/EPIC-FIX/_qa/SPEC-030";
const USAGE =
  "Uso: npm run cache:portada -- [--rondas <n>] [--espera <s>] [--url <base>] [--salida <fichero.jsonl>]";

function parseArgs(argv) {
  const args = {
    rondas: RONDAS,
    espera: ESPERA_S,
    url: "https://marcador.gal",
    salida: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const [flag, value] = [argv[i], argv[i + 1]];
    if (flag === "--rondas") args.rondas = Number(value);
    else if (flag === "--espera") args.espera = Number(value);
    else if (flag === "--url") args.url = value;
    else if (flag === "--salida") args.salida = value;
    else throw new Error(USAGE);
    i += 1;
  }
  if (!(Number.isInteger(args.rondas) && args.rondas > 0)) throw new Error(USAGE);
  if (!(args.espera >= 0)) throw new Error(USAGE);
  return args;
}

function get(url) {
  const client = url.startsWith("https:") ? https : http;
  return new Promise((resolve) => {
    client
      .get(url, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? null,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      })
      .on("error", (e) =>
        resolve({ status: null, headers: {}, body: "", error: e.message }),
      );
  });
}

const header = (h, name) => (typeof h[name] === "string" ? h[name] : null);
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const salida =
    args.salida ??
    path.join(QA_DIR, `cache-portada-${new Date().toISOString().slice(0, 19).replaceAll(":", "")}Z.jsonl`);
  mkdirSync(path.dirname(salida), { recursive: true });
  writeFileSync(salida, "");
  const respuestas = [];
  for (let ronda = 1; ronda <= args.rondas; ronda += 1) {
    console.log(`ronda ${ronda}/${args.rondas}: espera ${args.espera} s`);
    await sleep(args.espera);
    for (const ruta of RUTAS) {
      const inicio = new Date().toISOString();
      const r = await get(new URL(ruta, args.url).toString());
      const linea = {
        ronda,
        ruta,
        inicio,
        status: r.status,
        xVercelCache: header(r.headers, "x-vercel-cache"),
        age: header(r.headers, "age"),
        date: header(r.headers, "date"),
        frescura: frescuraEnHtml(r.body),
        ...(r.error ? { error: r.error } : {}),
      };
      respuestas.push(linea);
      appendFileSync(salida, `${JSON.stringify(linea)}\n`);
      console.log(
        `  ${ruta} ${linea.status} x-vercel-cache=${linea.xVercelCache} age=${linea.age} date=${linea.date} frescura=${linea.frescura}`,
      );
    }
  }
  const v = veredicto(respuestas);
  for (const f of v.fallos)
    console.log(`FALLO ronda ${f.respuesta.ronda} ${f.respuesta.ruta}: ${f.motivo}`);
  console.log(
    `${v.cumple ? "CUMPLE" : "NO CUMPLE"}: ${v.total - v.fallos.length}/${v.total} respuestas bien → ${salida}`,
  );
  process.exitCode = v.cumple ? 0 : 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 2;
});

#!/usr/bin/env node
// SPEC-067 CA-1: probes Buffer's API with the production client and the two
// variables of .env.local. Prints HTTP status, body and milliseconds; the key
// and the channel id never appear. Exits 1 without the variables, with a
// non-2xx answer or without an option.
//
// Usage: npm run social:probar -- --limites [--guardar limites]
//        npm run social:probar -- --canales
//        npm run social:probar -- --publicar "<texto>" [--modo <modo>] [--guardar <nombre>]
//        npm run social:probar -- --tipo CreatePostInput [--guardar <nombre>]
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runProbe } from "../src/social/buffer/probe.ts";

for (const envFile of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(envFile);
  } catch {
    // absent: rely on the environment
  }
}

const fixtures = fileURLToPath(
  new URL("../src/social/buffer/fixtures/", import.meta.url),
);

const outcome = await runProbe(process.argv.slice(2), {
  fetch: globalThis.fetch,
  env: process.env,
  now: () => new Date().toISOString(),
  writeFixture: async (name, content) => {
    if (!/^[a-z0-9-]+$/.test(name))
      throw new Error(`nombre de fixture no válido: ${name}`);
    await mkdir(fixtures, { recursive: true });
    const file = path.join(fixtures, `${name}.json`);
    await writeFile(file, `${content}\n`, "utf8");
    return path.relative(process.cwd(), file).split(path.sep).join("/");
  },
});
for (const line of outcome.lines) console.log(line);
process.exitCode = outcome.exitCode;

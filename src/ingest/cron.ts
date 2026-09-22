import type { Sql } from "postgres";
import type { Env } from "../db/env.ts";

// The two secrets the pg_cron job reads by name from vault.decrypted_secrets
// (H-4): the migration never carries a value, and these are put here from
// .env by npm run cron:setup. Nothing in this file prints a value.

export const TICK_URL_SECRET = "ingest_tick_url";
export const TICK_TOKEN_SECRET = "ingest_tick_token";

export type CronSecret = {
  name: string;
  value: string;
  description: string;
  variable: string;
};

function required(env: Env, variable: string): string {
  const value = env[variable];
  if (value === undefined || value === "")
    throw new Error(`${variable} is not set`);
  return value;
}

export function cronSecrets(env: Env): CronSecret[] {
  return [
    {
      name: TICK_URL_SECRET,
      variable: "INGEST_TICK_URL",
      value: required(env, "INGEST_TICK_URL"),
      description: "marcador.gal: URL of the ingest tick (SPEC-008 CA-3)",
    },
    {
      name: TICK_TOKEN_SECRET,
      variable: "INGEST_TICK_TOKEN",
      value: required(env, "INGEST_TICK_TOKEN"),
      description: "marcador.gal: bearer token of the ingest tick (ADR-008 §1)",
    },
  ];
}

type SecretRow = { id: string; name: string };

// The id of every secret already in the vault, by name.
//
// The list goes in as a plain JS array and NOT as sql.array(names). sql.array
// resolves the array type through options.shared.typeArrayMap, and postgres.js
// only fills that map when a connection finishes opening (connection.js,
// fetchArrayTypes, driven by needsTypes). The parameter is built while the
// template is assembled, so on the FIRST statement of a fresh pool — which is
// exactly what npm run cron:setup is — the map is still empty, the value binds
// as text instead of text[] and Postgres answers "op ANY/ALL (array) requires
// array on right side". A plain array is serialized without that map and works
// cold. Proven both ways in src/ingest/cron.db.test.ts.
export async function findSecretIds(
  sql: Sql,
  names: readonly string[],
): Promise<Map<string, string>> {
  const rows = await sql<SecretRow[]>`
    select id, name from vault.decrypted_secrets
    where name = any(${names as string[]})`;
  return new Map(rows.map((row) => [row.name, row.id]));
}

// Idempotent: create what is missing, update what is there, and report only
// names. Every value is read once and never leaves this function.
export async function setupCronSecrets(sql: Sql, env: Env): Promise<string[]> {
  const secrets = cronSecrets(env);
  const idOf = await findSecretIds(
    sql,
    secrets.map((s) => s.name),
  );

  const report: string[] = [];
  for (const secret of secrets) {
    const id = idOf.get(secret.name);
    if (id === undefined) {
      await sql`select vault.create_secret(
        ${secret.value}, ${secret.name}, ${secret.description})`;
      report.push(`${secret.name}: creado`);
    } else {
      await sql`select vault.update_secret(
        ${id}::uuid, ${secret.value}, ${secret.name}, ${secret.description})`;
      report.push(`${secret.name}: actualizado`);
    }
  }
  return report;
}

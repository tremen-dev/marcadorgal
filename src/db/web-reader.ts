import { createHash, createHmac, pbkdf2Sync, randomBytes } from "node:crypto";
import type { Sql } from "postgres";

// SPEC-020 CA-3: the secret of web_reader (ADR-014 §4). Postgres receives the
// SCRAM-SHA-256 verifier, never the password itself, so not even a statement
// log of the server can leak it.

const ITERATIONS = 4096;

// Printable ASCII only: then SASLprep is the identity and the verifier
// computed here is the one Postgres would compute.
export function parseWebReaderPassword(value: string | undefined): string {
  if (!value) throw new Error("WEB_READER_PASSWORD is not set");
  if (!/^[\x21-\x7e]+$/.test(value))
    throw new Error(
      "WEB_READER_PASSWORD must be printable ASCII without spaces (openssl rand -hex 32)",
    );
  if (value.length < 16)
    throw new Error("WEB_READER_PASSWORD must have at least 16 characters");
  return value;
}

export function scramVerifier(
  password: string,
  salt: Buffer = randomBytes(16),
): string {
  const salted = pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");
  const clientKey = createHmac("sha256", salted).update("Client Key").digest();
  const storedKey = createHash("sha256").update(clientKey).digest("base64");
  const serverKey = createHmac("sha256", salted)
    .update("Server Key")
    .digest("base64");
  return `SCRAM-SHA-256$${ITERATIONS}:${salt.toString("base64")}$${storedKey}:${serverKey}`;
}

export async function setWebReaderPassword(
  sql: Sql,
  password: string,
): Promise<void> {
  const verifier = scramVerifier(parseWebReaderPassword(password));
  // ALTER ROLE takes no bind parameters; the verifier is base64, $ and :
  // only, so it cannot close the literal.
  if (!/^[A-Za-z0-9+/=$:-]+$/.test(verifier)) throw new Error("bad verifier");
  await sql.unsafe(`alter role web_reader with password '${verifier}'`);
}

// SPEC-029 CA-2 (ADR-015 §4): a leaked web_reader can leave defaults on its
// own role (alter role web_reader set statement_timeout = 1) that a new
// password does not undo. Every row of pg_db_role_setting for the role goes,
// global and per database, and one left behind is an error that names no
// setting nor value.
export async function resetWebReaderSettings(sql: Sql): Promise<void> {
  await sql.unsafe("alter role web_reader reset all");
  const databases = await sql<{ datname: string }[]>`
    select d.datname from pg_db_role_setting s
    join pg_roles r on r.oid = s.setrole
    join pg_database d on d.oid = s.setdatabase
    where r.rolname = 'web_reader' and s.setdatabase <> 0`;
  for (const { datname } of databases)
    await sql.unsafe(
      `alter role web_reader in database "${datname.replaceAll('"', '""')}" reset all`,
    );
  const [{ count }] = await sql<{ count: number }[]>`
    select count(*)::int as count from pg_db_role_setting s
    join pg_roles r on r.oid = s.setrole where r.rolname = 'web_reader'`;
  if (count > 0)
    throw new Error(
      `web_reader: quedan ${count} ajustes en pg_db_role_setting`,
    );
}

// SPEC-029 CA-3 (H-2): a new password does not close the sessions already
// open, and one of them may hold the lock of openAttempt. Returns how many
// were terminated; the web reconnects in milliseconds.
export async function terminateWebReaderSessions(sql: Sql): Promise<number> {
  const rows = await sql<{ done: boolean }[]>`
    select pg_terminate_backend(pid) as done from pg_stat_activity
    where usename = 'web_reader' and pid <> pg_backend_pid()`;
  return rows.filter((r) => r.done).length;
}

import "server-only";
import postgres from "postgres";
import { databaseUrl } from "./env";

// prepare: false keeps the client usable behind the transaction pooler (N-6).
export const sql = postgres(databaseUrl(process.env), {
  ssl: "require",
  prepare: false,
});

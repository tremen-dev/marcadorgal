import "server-only";
import { createSql } from "./connect.ts";

export const sql = createSql(process.env);

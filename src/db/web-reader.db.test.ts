import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { getSql } from "./client.ts";
import { setWebReaderPassword } from "./web-reader.ts";

// SPEC-020 CA-3 against the local Supabase: the verifier set by
// db:web-reader lets web_reader log in, read web.xornada and nothing else.
const sql = getSql();
afterAll(() => sql.end());

describe("SPEC-020 CA-3 setWebReaderPassword", () => {
  it("web_reader logs in with it and only reads web.xornada", async () => {
    const password = crypto.randomUUID().replaceAll("-", "");
    await setWebReaderPassword(sql, password);
    const url = new URL(process.env.DATABASE_URL ?? "");
    url.username = "web_reader";
    url.password = password;
    const reader = postgres(url.toString(), {
      ssl: false,
      prepare: false,
      max: 1,
    });
    try {
      const [{ user }] = await reader`select current_user as user`;
      expect(user).toBe("web_reader");
      await expect(
        reader`select count(*) from web.xornada`,
      ).resolves.toHaveLength(1);
      await expect(reader`select 1 from public.matches`).rejects.toMatchObject({
        code: "42501",
      });
    } finally {
      await reader.end();
    }
  });
});

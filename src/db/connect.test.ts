import { describe, expect, it } from "vitest";
import { sqlOptionsFor } from "./connect";

// SPEC-020 CA-1: TLS everywhere except the local Supabase in Docker, which
// does not speak it. Nothing here opens a connection.
describe("SPEC-020 CA-1 sqlOptionsFor", () => {
  it("requires TLS for a remote host", () => {
    expect(
      sqlOptionsFor("postgresql://u:p@db.abc.supabase.co:5432/postgres"),
    ).toEqual({ ssl: "require", prepare: false });
  });

  it("goes without TLS on loopback", () => {
    expect(
      sqlOptionsFor("postgresql://postgres:postgres@127.0.0.1:54322/postgres"),
    ).toEqual({ ssl: false, prepare: false });
  });
});

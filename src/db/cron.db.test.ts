import { afterAll, describe, expect, it } from "vitest";
import { getSql } from "./client.ts";

const sql = getSql();
const TICK_TOKEN = "no-es-un-secreto-0123456789abcdef0123";
afterAll(() => sql.end());

type JobRow = {
  jobname: string;
  schedule: string;
  active: boolean;
  command: string;
};

describe("SPEC-008 CA-4 pg_cron job ingest-tick", () => {
  it("prints the version of pg_cron (H-3: seconds need 1.5 or newer)", async () => {
    const [row] = await sql<{ extversion: string }[]>`
      select extversion from pg_extension where extname = 'pg_cron'`;
    expect(row).toBeDefined();
    console.log(`pg_cron extversion: ${row.extversion}`);
  });

  it("has supabase_vault installed", async () => {
    const [row] = await sql<{ extversion: string }[]>`
      select extversion from pg_extension where extname = 'supabase_vault'`;
    expect(row).toBeDefined();
  });

  it("is scheduled exactly once, active, every 30 seconds", async () => {
    const jobs = await sql<JobRow[]>`
      select jobname, schedule, active, command from cron.job
      where jobname = 'ingest-tick'`;
    expect(jobs).toHaveLength(1);
    expect(jobs[0].active).toBe(true);
    expect(jobs[0].schedule).toBe("30 seconds");
  });

  it("reads url and token from the vault and carries no secret", async () => {
    const [job] = await sql<JobRow[]>`
      select jobname, schedule, active, command from cron.job
      where jobname = 'ingest-tick'`;
    expect(job.command).toContain("vault.decrypted_secrets");
    expect(job.command).toContain("net.http_post");
    expect(job.command).toContain("timeout_milliseconds := 55000");
    expect(job.command).not.toContain("Bearer sb");
    // A fixed, non-secret value (SPEC-022 CA-4): the suite reads no secret.
    expect(job.command).not.toContain(TICK_TOKEN);
  });
});

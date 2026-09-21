import { describe, expect, it, vi } from "vitest";
import type { Instant } from "@/model";
import { createTickHandler } from "./handler.ts";
import type { TickSummary } from "./tick.ts";

const summary = (now: Instant): TickSummary => ({
  now,
  inWindow: 0,
  purge: "skipped",
  attempts: [],
});

const post = (headers: HeadersInit = {}) =>
  new Request("https://marcador.gal/api/ingest/tick", {
    method: "POST",
    headers,
  });

describe("CA-9 createTickHandler", () => {
  it("answers 503 when the token is not configured", async () => {
    const run = vi.fn(async (now: Instant) => summary(now));
    const response = await createTickHandler({
      authorize: () => "unconfigured",
      run,
    })(post());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "tick not configured" });
    expect(run).not.toHaveBeenCalled();
  });

  it("answers 401 when the token does not match", async () => {
    const run = vi.fn(async (now: Instant) => summary(now));
    const response = await createTickHandler({
      authorize: () => "unauthorized",
      run,
    })(post());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(run).not.toHaveBeenCalled();
  });

  it("reads the Authorization header and answers 200 with the summary", async () => {
    const seen: (string | null)[] = [];
    const run = vi.fn(async (now: Instant) => summary(now));
    const response = await createTickHandler({
      authorize: (header) => {
        seen.push(header);
        return "ok";
      },
      run,
    })(post({ Authorization: "Bearer token" }));
    expect(seen).toEqual(["Bearer token"]);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    const body = (await response.json()) as TickSummary;
    expect(body).toMatchObject({ inWindow: 0, purge: "skipped", attempts: [] });
    expect(body.now).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
    expect(run).toHaveBeenCalledWith(body.now);
  });

  it("answers 500 without leaking the exception, and logs it", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await createTickHandler({
      authorize: () => "ok",
      run: async () => {
        throw new Error("postgres://user:secret@host is unreachable");
      },
    })(post());
    expect(response.status).toBe(500);
    const body = await response.text();
    expect(JSON.parse(body)).toEqual({ error: "tick failed" });
    expect(body).not.toContain("secret");
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("postgres://user:secret@host is unreachable"),
    );
    error.mockRestore();
  });
});

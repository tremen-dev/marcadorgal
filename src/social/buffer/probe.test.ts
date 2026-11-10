import { describe, expect, it } from "vitest";
import { type ProbeDeps, runProbe } from "./probe.ts";

// SPEC-067 CA-1: the probe uses the production client with the two variables
// of the local environment, prints status, body and ms, and never the key.
// The fake fetch echoes the authorization header in its body so that a leak
// would show: the sentinel key must not survive the redaction.

const KEY = "sk-sentinel-0123456789";
const CHANNEL = "ch-test-1";

type Fixture = { name: string; content: string };

function deps(
  respond: (body: string) => Response = (body) =>
    new Response(
      JSON.stringify({
        echo: JSON.parse(body),
        data: { account: { id: "a" } },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  env: Record<string, string | undefined> = {
    BUFFER_API_KEY: KEY,
    BUFFER_CHANNEL_ID: CHANNEL,
  },
): ProbeDeps & { calls: RequestInit[]; fixtures: Fixture[] } {
  const calls: RequestInit[] = [];
  const fixtures: Fixture[] = [];
  const fetchImpl = (async (_input: unknown, init?: RequestInit) => {
    calls.push(init ?? {});
    const headers = new Headers(init?.headers);
    const body = JSON.stringify({
      ...JSON.parse(String(init?.body)),
      authorization: headers.get("authorization"),
    });
    return respond(body);
  }) as typeof fetch;
  return {
    fetch: fetchImpl,
    env,
    now: () => "2026-11-10T18:00:00.000Z",
    writeFixture: async (name, content) => {
      fixtures.push({ name, content });
      return `src/social/buffer/fixtures/${name}.json`;
    },
    calls,
    fixtures,
  };
}

describe("SPEC-067 CA-1 npm run social:probar", () => {
  it("without BUFFER_API_KEY or BUFFER_CHANNEL_ID exits 1 and says which", async () => {
    const d = deps(undefined, { BUFFER_CHANNEL_ID: CHANNEL });
    const out = await runProbe(["--limites"], d);
    expect(out.exitCode).toBe(1);
    expect(out.lines.join("\n")).toMatch(/BUFFER_API_KEY/);
    expect(d.calls).toHaveLength(0);
  });

  it("without any option exits 1 with the usage", async () => {
    const out = await runProbe([], deps());
    expect(out.exitCode).toBe(1);
    expect(out.lines.join("\n")).toMatch(/--limites/);
  });

  it("--limites asks dailyPostingLimits for the channel and prints status, body and ms", async () => {
    const d = deps();
    const out = await runProbe(["--limites"], d);
    expect(out.exitCode).toBe(0);
    expect(d.calls).toHaveLength(1);
    const sent = JSON.parse(String(d.calls[0].body));
    expect(sent.query).toMatch(/dailyPostingLimits/);
    expect(sent.variables).toEqual({ channelIds: [CHANNEL] });
    const text = out.lines.join("\n");
    expect(text).toMatch(/HTTP 200/);
    expect(text).toMatch(/\d+ ms/);
    expect(text).toMatch(/2026-11-10T18:00:00.000Z/);
    expect(text).toMatch(/"account"/);
  });

  it("--publicar sends createPost with text, channelId, automatic scheduling and the mode", async () => {
    const d = deps();
    const out = await runProbe(
      ["--publicar", "Proba 1/5", "--modo", "addToQueue"],
      d,
    );
    expect(out.exitCode).toBe(0);
    const sent = JSON.parse(String(d.calls[0].body));
    expect(sent.query).toMatch(/createPost/);
    expect(sent.variables.input).toMatchObject({
      text: "Proba 1/5",
      channelId: CHANNEL,
      schedulingType: "automatic",
      mode: "addToQueue",
    });
  });

  it("--publicar sends the fields Buffer requires empty: no approval, no tags, no assets", async () => {
    const d = deps();
    await runProbe(["--publicar", "Proba"], d);
    const sent = JSON.parse(String(d.calls[0].body));
    expect(sent.variables.input).toMatchObject({
      mode: "shareNow",
      needsApproval: false,
      tagIds: [],
      assets: [],
    });
  });

  it("--post asks one post by id, to read sentAt and externalLink afterwards", async () => {
    const d = deps();
    const out = await runProbe(["--post", "p-1"], d);
    expect(out.exitCode).toBe(0);
    const sent = JSON.parse(String(d.calls[0].body));
    expect(sent.query).toMatch(/post\(input/);
    expect(sent.query).toMatch(/sentAt/);
    expect(sent.variables).toEqual({ id: "p-1" });
  });

  it("--guardar writes the raw answer as a fixture, and neither it nor the output carries the key", async () => {
    const d = deps();
    const out = await runProbe(["--limites", "--guardar", "limites"], d);
    expect(out.exitCode).toBe(0);
    expect(d.fixtures).toHaveLength(1);
    expect(d.fixtures[0].name).toBe("limites");
    const fixture = JSON.parse(d.fixtures[0].content);
    expect(fixture).toMatchObject({
      capturedAt: "2026-11-10T18:00:00.000Z",
      steps: [
        { requestedAt: "2026-11-10T18:00:00.000Z", response: { status: 200 } },
      ],
    });
    expect(fixture.steps[0].request.variables).toEqual({
      channelIds: ["<CHANNEL>"],
    });
    expect(fixture.steps[0].response.body).toMatch(/<KEY>/);
    expect(d.fixtures[0].content).not.toContain(KEY);
    expect(d.fixtures[0].content).not.toContain(CHANNEL);
    const text = out.lines.join("\n");
    expect(text).not.toContain(KEY);
    expect(text).toMatch(/<KEY>/);
    expect(text).toMatch(/fixtures\/limites\.json/);
  });

  it("a network failure is printed, not thrown, and exits 1", async () => {
    const d = deps(() => {
      throw new TypeError(`fetch failed for ${KEY}`);
    });
    const out = await runProbe(["--limites"], d);
    expect(out.exitCode).toBe(1);
    const text = out.lines.join("\n");
    expect(text).toMatch(/fetch failed/);
    expect(text).not.toContain(KEY);
  });

  it("a non-2xx answer is printed in full and exits 1", async () => {
    const d = deps(
      () => new Response('{"error":"unauthorized"}', { status: 401 }),
    );
    const out = await runProbe(["--limites"], d);
    expect(out.exitCode).toBe(1);
    expect(out.lines.join("\n")).toMatch(/HTTP 401/);
    expect(out.lines.join("\n")).toMatch(/unauthorized/);
  });
});

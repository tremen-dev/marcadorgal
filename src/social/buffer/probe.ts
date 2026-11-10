import {
  type BufferRaw,
  bufferRequest,
  type GraphqlRequest,
  redactSecret,
} from "./client.ts";
import {
  ACCOUNT,
  CREATE_POST,
  DAILY_POSTING_LIMITS,
  ORGANIZATION_CHANNELS,
  POST,
  TYPE_INTROSPECTION,
} from "./queries.ts";

// SPEC-067 CA-1: the probe behind `npm run social:probar`. Same transport as
// production (client.ts), the two variables of the local environment, one
// request per option, and the raw answer on screen and, with --guardar, in
// fixtures/. The key and the channel id never appear: both are redacted
// (ADR-030 §8). tools/social-probar.mjs is the shell; this is the logic, so
// it can be tested with a sentinel key and a fake fetch.

export type ProbeDeps = {
  fetch: typeof fetch;
  env: Readonly<Record<string, string | undefined>>;
  now: () => string;
  // Writes fixtures/<name>.json and returns the path written.
  writeFixture: (name: string, content: string) => Promise<string>;
};

export type ProbeOutcome = { exitCode: number; lines: string[] };

export const USAGE = [
  "Uso: npm run social:probar -- <opción> [--guardar <nombre>]",
  "  --limites                            dailyPostingLimits del canal",
  "  --canales                            canales de la cuenta (marca el del entorno)",
  "  --publicar <texto> [--modo <modo>]   createPost en el canal del entorno (modo por defecto: shareNow)",
  "  --post <id>                          un post por id (status, dueAt, sentAt, externalLink)",
  "  --tipo <Nombre>                      introspección de un tipo GraphQL",
  "  --guardar <nombre>                   escribe la respuesta cruda en src/social/buffer/fixtures/<nombre>.json",
  "Variables: BUFFER_API_KEY y BUFFER_CHANNEL_ID (.env.local).",
];

export const DEFAULT_MODE = "shareNow";

type Parsed =
  | { kind: "usage" }
  | {
      kind: "run";
      request: GraphqlRequest;
      save: string | null;
      channels: boolean;
    };

function parseArgs(args: readonly string[], channelId: string): Parsed {
  let save: string | null = null;
  let request: GraphqlRequest | null = null;
  let channels = false;
  let mode: string = DEFAULT_MODE;
  let text: string | null = null;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--limites")
      request = {
        query: DAILY_POSTING_LIMITS,
        variables: { channelIds: [channelId] },
      };
    else if (arg === "--canales") {
      request = { query: ACCOUNT };
      channels = true;
    } else if (arg === "--publicar") {
      text = args[i + 1] ?? "";
      i += 1;
    } else if (arg === "--modo") {
      mode = args[i + 1] ?? DEFAULT_MODE;
      i += 1;
    } else if (arg === "--post") {
      request = { query: POST, variables: { id: args[i + 1] ?? "" } };
      i += 1;
    } else if (arg === "--tipo") {
      request = {
        query: TYPE_INTROSPECTION,
        variables: { name: args[i + 1] ?? "" },
      };
      i += 1;
    } else if (arg === "--guardar") {
      save = args[i + 1] ?? null;
      i += 1;
    } else return { kind: "usage" };
  }
  if (text !== null)
    request = {
      query: CREATE_POST,
      variables: {
        // CreatePostInput (fixtures/tipo-create-post-input.json) requires
        // needsApproval, tagIds and assets; the port sends them empty too.
        input: {
          text,
          channelId,
          schedulingType: "automatic",
          mode,
          needsApproval: false,
          tagIds: [],
          assets: [],
        },
      },
    };
  if (request === null) return { kind: "usage" };
  return { kind: "run", request, save, channels };
}

export async function runProbe(
  args: readonly string[],
  deps: ProbeDeps,
): Promise<ProbeOutcome> {
  const lines: string[] = [];
  const apiKey = deps.env.BUFFER_API_KEY?.trim() ?? "";
  const channelId = deps.env.BUFFER_CHANNEL_ID?.trim() ?? "";
  const missing = [
    apiKey === "" ? "BUFFER_API_KEY" : null,
    channelId === "" ? "BUFFER_CHANNEL_ID" : null,
  ].filter((name): name is string => name !== null);
  if (missing.length > 0) {
    lines.push(
      `Faltan variables: ${missing.join(", ")} (ponlas en .env.local)`,
    );
    return { exitCode: 1, lines };
  }
  const parsed = parseArgs(args, channelId);
  if (parsed.kind === "usage") return { exitCode: 1, lines: [...USAGE] };

  const redact = (text: string): string =>
    redactSecret(text, apiKey).split(channelId).join("<CHANNEL>");

  const steps: GraphqlRequest[] = [parsed.request];
  let exitCode = 0;
  const captured: {
    requestedAt: string;
    request: GraphqlRequest;
    response: BufferRaw;
  }[] = [];
  while (steps.length > 0) {
    const request = steps.shift() as GraphqlRequest;
    let raw: BufferRaw;
    const requestedAt = deps.now();
    try {
      raw = await bufferRequest(deps.fetch, apiKey, request);
    } catch (e) {
      lines.push(
        `Error: ${redact(e instanceof Error ? e.message : String(e))}`,
      );
      return { exitCode: 1, lines };
    }
    captured.push({ requestedAt, request, response: raw });
    lines.push(`Petición ${requestedAt}: HTTP ${raw.status} en ${raw.ms} ms`);
    for (const name of ["content-type", "retry-after", "x-request-id"])
      if (raw.headers[name] !== undefined)
        lines.push(`${name}: ${raw.headers[name]}`);
    lines.push(redact(pretty(raw.body)));
    if (raw.status < 200 || raw.status >= 300) exitCode = 1;
    // --canales: the account first, then the channels of every organization,
    // with the one of the environment marked.
    if (parsed.channels && request.query === ACCOUNT && raw.status === 200)
      for (const organizationId of organizationIds(raw.body))
        steps.push({
          query: ORGANIZATION_CHANNELS,
          variables: { organizationId },
        });
    if (parsed.channels && request.query === ORGANIZATION_CHANNELS)
      lines.push(...channelLines(raw.body, channelId));
  }
  if (parsed.save !== null) {
    const content = JSON.stringify(
      {
        capturedAt: deps.now(),
        steps: captured.map(({ requestedAt, request, response }) => ({
          requestedAt,
          request: JSON.parse(redact(JSON.stringify(request))),
          response: { ...response, body: redact(response.body) },
        })),
      },
      null,
      2,
    );
    const path = await deps.writeFixture(parsed.save, content);
    lines.push(`Fixture: ${path}`);
  }
  return { exitCode, lines };
}

function pretty(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

function organizationIds(body: string): string[] {
  try {
    const parsed = JSON.parse(body) as {
      data?: { account?: { organizations?: { id?: unknown }[] } };
    };
    return (parsed.data?.account?.organizations ?? [])
      .map((o) => o.id)
      .filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

function channelLines(body: string, channelId: string): string[] {
  try {
    const parsed = JSON.parse(body) as {
      data?: {
        channels?: { id?: unknown; name?: unknown; service?: unknown }[];
      };
    };
    return (parsed.data?.channels ?? []).map((c) => {
      const mine = c.id === channelId;
      return `${mine ? "* " : "  "}${String(c.service)} ${String(c.name)}${mine ? "  <- BUFFER_CHANNEL_ID del entorno" : ""}`;
    });
  } catch {
    return [];
  }
}

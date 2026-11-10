// SPEC-067 CA-3 (ADR-030 §4-§5, §8): the transport to Buffer's GraphQL API.
// One POST per call, the bearer in the header, and the answer back as it
// came: status, headers, body and milliseconds. Interpreting it is the job
// of publisher.ts (the port) and probe.ts (the probe); the raw comes first.
// `fetch` is injected: no test here ever reaches the network.

export const BUFFER_ENDPOINT = "https://api.buffer.com";

// ADR-030 §4: five seconds per request.
export const BUFFER_TIMEOUT_MS = 5_000;

export type GraphqlRequest = {
  query: string;
  variables?: Readonly<Record<string, unknown>>;
};

export type BufferRaw = {
  status: number;
  // Lower-case names, as the Headers object yields them.
  headers: Readonly<Record<string, string>>;
  body: string;
  ms: number;
};

export type BufferRequestOptions = {
  timeoutMs?: number;
  endpoint?: string;
};

// Throws what fetch throws (network, abort as TimeoutError); never parses.
export async function bufferRequest(
  fetchImpl: typeof fetch,
  apiKey: string,
  request: GraphqlRequest,
  options: BufferRequestOptions = {},
): Promise<BufferRaw> {
  const started = performance.now();
  const response = await fetchImpl(options.endpoint ?? BUFFER_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      query: request.query,
      variables: request.variables ?? {},
    }),
    signal: AbortSignal.timeout(options.timeoutMs ?? BUFFER_TIMEOUT_MS),
  });
  const body = await response.text();
  const headers: Record<string, string> = {};
  response.headers.forEach((value, name) => {
    headers[name] = value;
  });
  return {
    status: response.status,
    headers,
    body,
    ms: Math.round(performance.now() - started),
  };
}

// ADR-030 §8: the key never leaves the process in a line of output, a
// fixture or a result. Every occurrence becomes <KEY>.
export function redactSecret(text: string, secret: string): string {
  if (secret === "") return text;
  return text.split(secret).join("<KEY>");
}

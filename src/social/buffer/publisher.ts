import { z } from "zod";
import type { PublishResult, SocialPublisher } from "../publisher.ts";
import {
  BUFFER_TIMEOUT_MS,
  type BufferRaw,
  bufferRequest,
  redactSecret,
} from "./client.ts";
import { CREATE_POST } from "./queries.ts";

// SPEC-067 CA-3 (ADR-030 §4-§5, §8): the Buffer implementation of the port.
// One createPost per publish and nothing else (CA-5); the answer is mapped
// to the four results of the port from what the probe captured in
// fixtures/ (CA-2). The key never reaches a result: every reason is
// redacted.

// CA-2 (a): createPost accepts shareNow and answers `sent` with sentAt
// about 1.5 s after the request (fixtures/create-post-share-now*.json).
export const BUFFER_MODE = "shareNow";

export type BufferPublisherOptions = {
  apiKey: string;
  channelId: string;
  fetch: typeof fetch;
  timeoutMs?: number;
};

export function createBufferPublisher(
  options: BufferPublisherOptions,
): SocialPublisher {
  const { apiKey, channelId } = options;
  const timeoutMs = options.timeoutMs ?? BUFFER_TIMEOUT_MS;
  const redact = (text: string): string => oneLine(redactSecret(text, apiKey));
  return {
    id: "buffer",
    async publish(text) {
      let raw: BufferRaw;
      try {
        raw = await bufferRequest(
          options.fetch,
          apiKey,
          {
            query: CREATE_POST,
            variables: {
              // CreatePostInput (fixtures/tipo-create-post-input.json):
              // needsApproval, tagIds and assets are required, and empty.
              input: {
                text,
                channelId,
                schedulingType: "automatic",
                mode: BUFFER_MODE,
                needsApproval: false,
                tagIds: [],
                assets: [],
              },
            },
          },
          { timeoutMs },
        );
      } catch (e) {
        // Abort (timeout), network: nobody knows whether it went out.
        return { outcome: "unknown", reason: redact(errorMessage(e)) };
      }
      return mapCreatePost(raw, redact);
    },
  };
}

// The body of a 2xx answer to createPost, as the fixtures show it. The
// union PostActionPayload is PostActionSuccess or an implementation of the
// interface MutationError, every one with a message
// (fixtures/tipo-post-action-payload.json, tipo-mutation-error.json).
const CreatePostBody = z.object({
  data: z
    .object({
      createPost: z
        .union([
          z.object({
            __typename: z.literal("PostActionSuccess"),
            post: z.object({ id: z.string().min(1) }),
          }),
          z.object({ __typename: z.string(), message: z.string() }),
        ])
        .nullish(),
    })
    .nullish(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

// Top-level GraphQL errors (a 401, a bad variable): one message is enough.
const ErrorsBody = z.object({
  errors: z.array(z.object({ message: z.string() })).min(1),
});

function mapCreatePost(
  raw: BufferRaw,
  redact: (text: string) => string,
): PublishResult {
  const { status } = raw;
  if (status === 429) {
    const retryAfter = raw.headers["retry-after"];
    return {
      outcome: "retry",
      reason:
        retryAfter === undefined
          ? "HTTP 429"
          : `HTTP 429, Retry-After ${redact(retryAfter)}`,
    };
  }
  if (status >= 500) return { outcome: "retry", reason: `HTTP ${status}` };
  if (status < 200 || status >= 300) {
    const message = firstError(raw.body);
    return {
      outcome: "rejected",
      reason:
        message === null
          ? `HTTP ${status}`
          : `HTTP ${status}: ${redact(message)}`,
    };
  }
  const body = parseJson(raw.body);
  const parsed = CreatePostBody.safeParse(body);
  if (!parsed.success)
    return {
      outcome: "unknown",
      reason: `HTTP ${status} with an unexpected body: ${redact(raw.body.slice(0, 120))}`,
    };
  const createPost = parsed.data.data?.createPost;
  if (createPost === null || createPost === undefined) {
    const message = parsed.data.errors?.[0]?.message;
    return message === undefined
      ? {
          outcome: "unknown",
          reason: `HTTP ${status} without createPost in the body`,
        }
      : { outcome: "rejected", reason: `GraphQL: ${redact(message)}` };
  }
  if (createPost.__typename === "PostActionSuccess")
    return { outcome: "sent", providerPostId: createPost.post.id };
  return {
    outcome: "rejected",
    reason: `${createPost.__typename}: ${redact(createPost.message)}`,
  };
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

function firstError(body: string): string | null {
  const parsed = ErrorsBody.safeParse(parseJson(body));
  return parsed.success ? parsed.data.errors[0].message : null;
}

const oneLine = (text: string): string => text.replace(/\s+/g, " ").trim();

const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

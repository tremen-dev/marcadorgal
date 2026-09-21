import { gzipSync } from "node:zlib";
import {
  type RawCapture,
  RawCapture as RawCaptureSchema,
} from "../model/index.ts";
import type { RawStore } from "./store.ts";

// One object per capture, gzipped (ADR-007 §2). The key is
// <sourceId>/<day>/<capturedAt>-<attemptId>.json.gz with ':' turned into '-'
// so it stays a plain path segment; the day comes from capturedAt in UTC.
export const RAW_BUCKET = "raw";
export const RAW_CONTENT_TYPE = "application/gzip";

export function rawKey(capture: RawCapture, attemptId: string): string {
  const day = capture.capturedAt.slice(0, 10);
  const stamp = capture.capturedAt.replaceAll(":", "-");
  return `${capture.sourceId}/${day}/${stamp}-${attemptId}.json.gz`;
}

// raw_ref = bucket + key, self-describing (ADR-007 §3).
export function rawRef(key: string): string {
  return `${RAW_BUCKET}/${key}`;
}

export function encodeCapture(capture: unknown): Uint8Array {
  return gzipSync(JSON.stringify(RawCaptureSchema.parse(capture)));
}

// Raw before parse, in the strong sense (ADR-007 §6): the caller only parses
// once this has resolved.
export async function storeCapture(
  store: RawStore,
  capture: RawCapture,
  attemptId: string,
): Promise<string> {
  const key = rawKey(capture, attemptId);
  await store.put(key, encodeCapture(capture), RAW_CONTENT_TYPE);
  return rawRef(key);
}

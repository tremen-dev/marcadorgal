#!/usr/bin/env node
// SPEC-024 CA-11: the First Load JS of a prerendered route after `next build`
// (Next 16 with Turbopack no longer prints it). Sums every script the HTML
// loads, raw and gzip, and says whether any of them carries supabase-js.
//
// Usage: node tools/first-load-js.mjs [index|es]  (default: index, i.e. /)
import { readFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const page = process.argv[2] ?? "index";
const root = path.resolve(import.meta.dirname, "..");
const html = readFileSync(
  path.join(root, ".next/server/app", `${page}.html`),
  "utf8",
);
const srcs = [
  ...new Set(
    [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1]),
  ),
];
let raw = 0;
let gzip = 0;
let supabase = false;
for (const src of srcs) {
  const file = path.join(root, ".next", src.replace(/^\/_next\//, ""));
  const body = readFileSync(file);
  raw += body.length;
  gzip += gzipSync(body).length;
  if (/@supabase|RealtimeClient|phoenix/.test(body.toString("utf8")))
    supabase = true;
}
const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
console.log(
  `/${page === "index" ? "" : page}: ${srcs.length} scripts, ${kb(raw)} raw, ${kb(gzip)} gzip, supabase-js ${supabase ? "PRESENT" : "absent"}`,
);

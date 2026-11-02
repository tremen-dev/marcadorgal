#!/usr/bin/env node
// SPEC-043 CA-3 (ADR-024 §4): masks the parts of DATABASE_URL in the GitHub
// Actions log before the Supabase CLI runs. GitHub only masks the secret as a
// whole; the CLI's connection errors print `host=… user=…` on their own.
// Prints nothing but `::add-mask::` commands, which the runner consumes and
// never shows; on a missing or unparsable URL it fails without echoing it.
const raw = process.env.DATABASE_URL;

let url;
try {
  url = new URL(raw ?? "");
} catch {
  console.error("DATABASE_URL is missing or is not a URL");
  process.exit(1);
}

const decode = (s) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

const parts = new Set(
  [
    raw,
    url.hostname,
    url.host,
    url.username,
    decode(url.username),
    url.password,
    decode(url.password),
  ].filter((p) => p && p.length > 0),
);

for (const part of parts) {
  process.stdout.write(`::add-mask::${part}\n`);
}

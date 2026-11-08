#!/usr/bin/env node
// Version gate (SPEC-063 CA-4, ADR-028): every PR bumps package.json's version
// unless it only touches data/calendario/** or data/alias/**. Reads the base
// version from git, head version and lockfile from the working tree, and the
// changed paths from `git diff --name-only <base> HEAD`. Exits 0 or 1.
//
// Usage: node tools/version-gate.mjs --base <ref>
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { evaluateGate } from "../src/lib/version-bump.ts";

const args = process.argv.slice(2);
const at = args.indexOf("--base");
const base = at >= 0 ? args[at + 1] : undefined;
if (!base) {
  console.error("Uso: node tools/version-gate.mjs --base <ref>");
  process.exit(2);
}

const git = (...gitArgs) =>
  execFileSync("git", gitArgs, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

let baseVersion;
let paths;
try {
  baseVersion = JSON.parse(git("show", `${base}:package.json`)).version ?? "";
  paths = git("diff", "--name-only", base, "HEAD")
    .split(/\r?\n/)
    .filter((line) => line.length > 0);
} catch (e) {
  console.error(`version-gate: no se pudo leer la base «${base}» con git.`);
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));

const { code, message } = evaluateGate({ baseVersion, pkg, lock, paths });
(code === 0 ? console.log : console.error)(message);
process.exit(code);

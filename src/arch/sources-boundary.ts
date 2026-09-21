import path from "node:path";
import ts from "typescript";

export type Violation = { file: string; specifier: string; reason: string };

const MODEL_DIR = "src/model";
const SOURCES_DIR = "src/sources";

// Import specifiers a source adapter may use (FOUNDATION: src/sources/* only
// imports from src/model). A file directly under src/sources/ (the registry,
// SPEC-005 CA-9) may also import its own level, never an adapter folder.
// `file` is repo-relative, posix or native.
export function checkSourceImports(file: string, source: string): Violation[] {
  const posixFile = file.split(path.sep).join(path.posix.sep);
  const isTest = /\.test\.tsx?$/.test(posixFile);
  const ownDir = ownSourceDir(posixFile);
  const violations: Violation[] = [];

  for (const { fileName: specifier } of ts.preProcessFile(source, true, true)
    .importedFiles) {
    const reason = disallowed(specifier, posixFile, ownDir, isTest);
    if (reason) violations.push({ file, specifier, reason });
  }
  return violations;
}

function ownSourceDir(file: string): string | null {
  const match = file.match(/^(?:.*\/)?src\/sources\/([^/]+)\//);
  return match ? `${SOURCES_DIR}/${match[1]}` : null;
}

const isTopLevel = (file: string): boolean =>
  /^(?:.*\/)?src\/sources\/[^/]+$/.test(file);

// Same level as a top-level file: src/sources/<name>, no deeper.
const sameTopLevel = (resolved: string): boolean =>
  resolved.startsWith(`${SOURCES_DIR}/`) &&
  !resolved.slice(SOURCES_DIR.length + 1).includes("/");

function disallowed(
  specifier: string,
  file: string,
  ownDir: string | null,
  isTest: boolean,
): string | null {
  if (specifier === "zod" || specifier.startsWith("node:")) return null;
  if (specifier === "vitest")
    return isTest ? null : "vitest is only allowed in *.test.ts";
  if (specifier === "@/model" || specifier.startsWith("@/model/")) return null;
  if (specifier.startsWith(".")) {
    const resolved = path.posix.join(path.posix.dirname(file), specifier);
    if (within(resolved, MODEL_DIR)) return null;
    if (ownDir && within(resolved, ownDir)) return null;
    if (!ownDir && isTopLevel(file) && sameTopLevel(resolved)) return null;
    const own = ownDir
      ? `${ownDir}/`
      : `${SOURCES_DIR}/ at the same level (never an adapter folder)`;
    return `relative import must stay inside ${MODEL_DIR}/ or ${own}`;
  }
  return `only zod, node:*, @/model/* and relative imports of ${MODEL_DIR}/ or the adapter folder are allowed`;
}

function within(resolved: string, dir: string): boolean {
  return resolved === dir || resolved.startsWith(`${dir}/`);
}

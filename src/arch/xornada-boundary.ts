import path from "node:path";
import ts from "typescript";
import type { Violation } from "./sources-boundary";

const MODEL_DIR = "src/model";
const XORNADA_DIR = "src/xornada";

// The Xornada view model is pure (SPEC-019 CA-2): src/xornada/ only imports
// from src/model, zod and its own folder; vitest only in its tests. No i18n,
// no React, no db, no clock module. `file` is repo-relative, posix or native.
export function checkXornadaImports(file: string, source: string): Violation[] {
  const posixFile = file.split(path.sep).join(path.posix.sep);
  const isTest = /\.test\.tsx?$/.test(posixFile);
  const violations: Violation[] = [];
  for (const { fileName: specifier } of ts.preProcessFile(source, true, true)
    .importedFiles) {
    const reason = disallowed(specifier, posixFile, isTest);
    if (reason) violations.push({ file, specifier, reason });
  }
  return violations;
}

function disallowed(
  specifier: string,
  file: string,
  isTest: boolean,
): string | null {
  if (specifier === "zod") return null;
  if (specifier === "vitest")
    return isTest ? null : "vitest is only allowed in *.test.ts";
  if (specifier === "@/model" || specifier.startsWith("@/model/")) return null;
  if (specifier.startsWith(".")) {
    const resolved = path.posix.join(path.posix.dirname(file), specifier);
    if (within(resolved, MODEL_DIR) || within(resolved, XORNADA_DIR))
      return null;
    return `relative import must stay inside ${MODEL_DIR}/ or ${XORNADA_DIR}/`;
  }
  return `only zod, @/model/* and relative imports of ${MODEL_DIR}/ or ${XORNADA_DIR}/ are allowed`;
}

function within(resolved: string, dir: string): boolean {
  return resolved === dir || resolved.startsWith(`${dir}/`);
}

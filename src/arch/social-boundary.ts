import path from "node:path";
import ts from "typescript";

export type Violation = { file: string; specifier: string; reason: string };

const SOCIAL = "src/social";
const CLOSED_TO_SOCIAL = ["src/decide", "src/sources", "src/ingest"] as const;

// SPEC-066 CA-12 (ADR-030 §5): a file under src/social/ never imports
// src/decide, src/sources or src/ingest; a file under any of those never
// imports src/social. Specifiers are resolved for both the "@/" alias and
// relative paths. `file` is repo-relative, posix or native.
export function checkSocialImports(file: string, source: string): Violation[] {
  const posixFile = file.split(path.sep).join(path.posix.sep);
  const inSocial = within(posixFile, SOCIAL);
  const closed = CLOSED_TO_SOCIAL.find((dir) => within(posixFile, dir));
  if (!inSocial && closed === undefined) return [];
  const violations: Violation[] = [];
  for (const { fileName: specifier } of ts.preProcessFile(source, true, true)
    .importedFiles) {
    const resolved = resolve(specifier, posixFile);
    if (resolved === null) continue;
    if (inSocial) {
      const hit = CLOSED_TO_SOCIAL.find((dir) => within(resolved, dir));
      if (hit !== undefined)
        violations.push({
          file,
          specifier,
          reason: `${SOCIAL}/ never imports ${hit}/`,
        });
    } else if (within(resolved, SOCIAL)) {
      violations.push({
        file,
        specifier,
        reason: `${closed}/ never imports ${SOCIAL}/`,
      });
    }
  }
  return violations;
}

// A repo-relative posix path for "@/..." and relative specifiers; null for
// a package.
function resolve(specifier: string, file: string): string | null {
  if (specifier.startsWith("@/")) return `src/${specifier.slice(2)}`;
  if (specifier.startsWith("."))
    return path.posix.join(path.posix.dirname(file), specifier);
  return null;
}

function within(resolved: string, dir: string): boolean {
  return resolved === dir || resolved.startsWith(`${dir}/`);
}

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { ADAPTERS } from "../ingest/adapters.ts";
import { SOURCES } from "../sources/registry.ts";
import { checkSourceImports } from "./sources-boundary.ts";

// SPEC-031 CA-8: src/sources/rfef/ only imports the model, runs no foreign
// code and reads no clock; and it is not registered anywhere.

const root = path.resolve(__dirname, "../..");
const DIR = "src/sources/rfef";

const files = readdirSync(path.join(root, DIR))
  .filter((f) => f.endsWith(".ts"))
  .map((f) => `${DIR}/${f}`);
const code = files.filter((f) => !f.endsWith(".test.ts"));
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

type Finding = { file: string; what: string };

// Calls, not strings: decode.ts names the packer ("eval(function…") as text.
function forbiddenIn(file: string, source: string): Finding[] {
  const found: Finding[] = [];
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "eval"
    )
      found.push({ file, what: "eval" });
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      (node.expression.text === "Function" || node.expression.text === "Date")
    )
      found.push({ file, what: `new ${node.expression.text}(` });
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "Date" &&
      node.name.text === "now"
    )
      found.push({ file, what: "Date.now" });
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      /^(node:)?vm$/.test(node.moduleSpecifier.text)
    )
      found.push({ file, what: "node:vm" });
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0]) &&
      /^(node:)?vm$/.test(node.arguments[0].text)
    )
      found.push({ file, what: "node:vm" });
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

describe("SPEC-031 CA-8 fronteras de src/sources/rfef", () => {
  it("has code to check", () => {
    expect(code).toContain(`${DIR}/adapter.ts`);
    expect(code).toContain(`${DIR}/decode.ts`);
  });

  it.each(files)("%s only imports the model, zod, node: or its folder", (f) => {
    expect(checkSourceImports(f, read(f))).toEqual([]);
  });

  it.each(code)(
    "%s has no eval, new Function, node:vm, Date.now or new Date(",
    (f) => {
      expect(forbiddenIn(f, read(f))).toEqual([]);
    },
  );

  it("the check catches each forbidden form", () => {
    const bad = [
      'eval("1")',
      'new Function("return 1")',
      'import vm from "node:vm"',
      'const m = await import("vm")',
      "Date.now()",
      "new Date(0)",
    ];
    for (const src of bad) expect(forbiddenIn("x.ts", src)).toHaveLength(1);
    expect(
      forbiddenIn("x.ts", 'const s = "eval(function(p,a,c,k,e,d)"'),
    ).toEqual([]);
  });

  it("is in neither the registry nor ADAPTERS", () => {
    expect(SOURCES.map((s) => s.id)).not.toContain("rfef");
    expect(Object.keys(ADAPTERS)).not.toContain("rfef");
    expect(read("src/sources/registry.ts")).not.toMatch(/["']rfef["']/);
    expect(read("src/ingest/adapters.ts")).not.toMatch(
      /sources\/rfef|["']rfef["']/,
    );
  });
});

// Writes src/design/tokens.css from src/design/tokens.ts.
// Runs on Node's native type stripping (Node >= 24): no tsx, no build step.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderTokensCss } from "../src/design/css.ts";

const target = fileURLToPath(new URL("../src/design/tokens.css", import.meta.url));
writeFileSync(target, renderTokensCss());
console.log(`tokens-css: wrote ${target}`);

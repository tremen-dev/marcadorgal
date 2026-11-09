// Compare row metrics: node compare-068.mjs <branch.json> [<main.json>]
import { readFileSync } from "node:fs";
const [, , branchPath, mainPath] = process.argv;
const branch = JSON.parse(readFileSync(branchPath, "utf8"));
const main = mainPath ? JSON.parse(readFileSync(mainPath, "utf8")) : null;
let bad = 0;
const key = (r) => JSON.stringify({ h: r.height, n: r.names, s: r.scores });
for (const width of Object.keys(branch)) {
  const { plain, noBlocks, noBlocksNoAffordance } = branch[width];
  const withGoals = plain.filter((r) => r.hasGoals).map((r) => r.id);
  console.log(`\n== ${width} px: ${plain.length} rows, ${withGoals.length} with goals`);
  // Proxy (CA-6 letter): blocks out of flow -> nothing moves.
  for (let i = 0; i < plain.length; i++) {
    if (key(plain[i]) !== key(noBlocks[i])) {
      bad++;
      console.log(`  DIFF proxy ${plain[i].id}: ${key(plain[i])} -> ${key(noBlocks[i])}`);
    }
  }
  console.log(`  proxy (display:none on blocks): ${bad === 0 ? "identical for every row" : "differences above"}`);
  for (const id of withGoals) {
    const r = plain.find((x) => x.id === id);
    console.log(`  row ${id}: height=${r.height} names=${JSON.stringify(r.names)} scores=${JSON.stringify(r.scores)}`);
  }
  if (main) {
    const m = main[width].plain;
    let diffs = 0;
    for (const r of noBlocksNoAffordance) {
      const o = m.find((x) => x.id === r.id);
      if (!o) { console.log(`  main lacks ${r.id}`); diffs++; continue; }
      if (key(r) !== key(o)) {
        diffs++;
        console.log(`  DIFF vs main ${r.id}${r.hasGoals ? " (goals)" : ""}: main ${key(o)} branch ${key(r)}`);
      }
    }
    // Also raw branch (with affordance) vs main
    let rawDiffs = 0;
    for (const r of plain) {
      const o = m.find((x) => x.id === r.id);
      if (o && key(r) !== key(o)) {
        rawDiffs++;
        console.log(`  raw DIFF vs main ${r.id}${r.hasGoals ? " (goals)" : ""}: main ${key(o)} branch ${key(r)}`);
      }
    }
    console.log(`  vs origin/main (blocks+affordance hidden): ${diffs === 0 ? "identical for every row" : diffs + " differences"}`);
    console.log(`  vs origin/main (raw, folded as served): ${rawDiffs === 0 ? "identical for every row" : rawDiffs + " differences"}`);
    bad += diffs;
  }
}
process.exit(bad ? 1 : 0);

// SPEC-030 F-SPEC-030-1: serves the built app as Vercel's function does
// (Next minimal mode: no custom routes; the platform applies the headers()
// of next.config from .next/routes-manifest.json) and prints, for / and /es,
// what the function answers and what the platform adds on top.
// Usage: npm run build && node sonda-minimal-mode.cjs <repo>
const http = require("node:http");
const path = require("node:path");
const dir = process.argv[2];
process.chdir(dir);
const next = require(require.resolve("next", { paths: [dir] }));
const manifest = require(path.join(dir, ".next/routes-manifest.json"));
const app = next({ dev: false, dir, minimalMode: true });
app.prepare().then(() => {
  const handle = app.getRequestHandler();
  const server = http.createServer((req, res) => handle(req, res));
  server.listen(3218, async () => {
    for (const p of ["/", "/es"]) {
      const r = await fetch(`http://localhost:3218${p}`);
      console.log(
        `function ${p} ${r.status} cache-control: ${r.headers.get("cache-control")} | vercel-cdn-cache-control: ${r.headers.get("vercel-cdn-cache-control")}`,
      );
      const rule = manifest.headers.find((h) => h.source === p);
      console.log(`platform ${p} ${JSON.stringify(rule?.headers ?? [])}`);
    }
    server.close();
    process.exit(0);
  });
});

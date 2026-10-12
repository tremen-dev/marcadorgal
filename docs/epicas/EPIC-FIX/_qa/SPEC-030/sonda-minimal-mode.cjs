// Serves the built app as Vercel's function does (Next minimal mode: no
// custom routes, the platform applies next.config headers) and prints the
// headers of / and /es.
const http = require("node:http");
const dir = process.argv[2];
process.chdir(dir);
const next = require(require.resolve("next", { paths: [dir] }));
const app = next({ dev: false, dir, minimalMode: true });
app.prepare().then(() => {
  const handle = app.getRequestHandler();
  const server = http.createServer((req, res) => handle(req, res));
  server.listen(3218, async () => {
    for (const p of ["/", "/es", "/api/board"]) {
      const r = await fetch(`http://localhost:3218${p}`);
      console.log(p, r.status, "cache-control:", r.headers.get("cache-control"), "| x-nextjs-cache:", r.headers.get("x-nextjs-cache"));
    }
    server.close();
    process.exit(0);
  });
});

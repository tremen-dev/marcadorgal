// SPEC-065 CA-7: a stand-in for the Explorer's export API, so that a
// standings table with a form guide can be painted in e2e without the
// network. Serves e2e/fixtures/explorer-standings.json for any competition;
// every other path is a 404 (the pages fall back as they do in production).
// Usage: node e2e/fixtures/explorer-mock.mjs <port>
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

const port = Number(process.argv[2] ?? 3103);
const standings = JSON.parse(
  readFileSync(new URL("./explorer-standings.json", import.meta.url), "utf8"),
);

createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  if (url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/plain" }).end("ok");
    return;
  }
  if (url.pathname === "/api/export/standings") {
    const competition = url.searchParams.get("competition") ?? "";
    res
      .writeHead(200, { "content-type": "application/json" })
      .end(JSON.stringify({ ...standings, competition }));
    return;
  }
  res.writeHead(404).end();
}).listen(port, "127.0.0.1");

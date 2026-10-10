// node probe.mjs <label> <json-headers> [url]
import https from "node:https"; import zlib from "node:zlib";
const [label, hjson = "{}", url = "https://marcador.gal/"] = process.argv.slice(2);
const headers = JSON.parse(hjson);
const t0 = new Date().toISOString();
https.get(url, { headers }, (res) => {
  const chunks = []; res.on("data", (c) => chunks.push(c)); res.on("end", () => {
    let buf = Buffer.concat(chunks); const enc = res.headers["content-encoding"];
    try { if (enc === "br") buf = zlib.brotliDecompressSync(buf); else if (enc === "gzip") buf = zlib.gunzipSync(buf); else if (enc === "zstd") buf = zlib.zstdDecompressSync(buf); } catch (e) { }
    const body = buf.toString();
    const fresh = (body.match(/Actualizado [^<"]*/) || [""])[0];
    const vs = [...body.matchAll(/data-version="(\d+)"/g)].map((m) => +m[1]);
    const live = (body.match(/data-status="live"/g) || []).length;
    const h = res.headers;
    console.log(`${label} | at=${t0} | status=${res.statusCode} | age=${h.age} | x-vercel-cache=${h["x-vercel-cache"]} | enc=${enc ?? "-"} | ctype=${(h["content-type"]||"").split(";")[0]} | etag=${h.etag} | fresh="${fresh}" | maxVersion=${vs.length ? Math.max(...vs) : "-"} | live=${live} | id=${h["x-vercel-id"]} | date=${h.date}`);
  });
}).on("error", (e) => console.log(label, "ERR", e.message));

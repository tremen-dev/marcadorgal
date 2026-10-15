// SPEC-015 CA-5 — crudo del proveedor a mitad de partido para los 4 casos. SOLO LECTURA (select + GET Storage).
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, idle_timeout: 5 });
const CASOS = {
  "segunda-rfef-g1-2026-27-j6-astorga-ourense-cf": "2026-10-10T15:15:00Z",
  "tercera-rfef-g1-2026-27-j6-pontevedra-b-portonovo": "2026-10-10T18:45:00Z",
  "tercera-rfef-g1-2026-27-j6-antela-barco": "2026-10-11T16:15:00Z",
  "tercera-rfef-g1-2026-27-j6-celtiga-alondras": "2026-10-11T16:15:00Z",
};
const refs = [];
try {
  await sql.begin("read only", async (tx) => {
    await tx.unsafe("set local statement_timeout = '30s'");
    for (const [id, t] of Object.entries(CASOS)) {
      const r = await tx.unsafe(
        "select match_id, status, observed_at, raw_ref from public.observations where match_id = $1 and observed_at >= $2::timestamptz order by observed_at limit 1",
        [id, t]);
      refs.push(r[0]);
    }
  });
} finally { await sql.end({ timeout: 5 }); }
const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
for (const r of refs) {
  console.log("##", r.match_id, r.status, r.observed_at, r.raw_ref);
  const [bucket, ...rest] = r.raw_ref.replace(/^storage:\/\//, "").split("/");
  const url = `${base}/storage/v1/object/authenticated/${bucket}/${rest.join("/")}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${key}`, apikey: key } });
  console.log("GET", res.status);
  const buf = Buffer.from(await res.arrayBuffer()); const text = (await import("node:zlib")).gunzipSync(buf).toString();
  const raw = JSON.parse(text);
  console.log("capturedAt", raw.capturedAt, "requests", raw.requests.length);
  for (const q of raw.requests) {
    let b; try { b = JSON.parse(q.body); } catch { console.log("  ", q.url, q.status, "(cuerpo no JSON)"); continue; }
    console.log("  ", q.url, q.status, "results:", b.results, "errors:", JSON.stringify(b.errors));
    for (const f of b.response ?? []) {
      console.log("     ", f.fixture?.id, f.league?.id, f.teams?.home?.name, "-", f.teams?.away?.name, f.fixture?.date, f.fixture?.status?.short, f.fixture?.status?.elapsed, `${f.goals?.home}-${f.goals?.away}`);
    }
  }
}

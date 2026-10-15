// SPEC-015 CA-5 — detalle de los casos «finished sin live», SOLO LECTURA.
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, idle_timeout: 5 });
const CASOS = [
  "segunda-rfef-g1-2026-27-j6-astorga-ourense-cf",
  "tercera-rfef-g1-2026-27-j6-pontevedra-b-portonovo",
  "tercera-rfef-g1-2026-27-j6-antela-barco",
  "tercera-rfef-g1-2026-27-j6-celtiga-alondras",
  "tercera-rfef-g1-2026-27-j6-villalbes-estradense", // control con live
];
try {
  const out = await sql.begin("read only", async (tx) => {
    await tx.unsafe("set local statement_timeout = '30s'");
    const ro = await tx.unsafe("select current_setting('transaction_read_only') ro");
    // Tramos consecutivos de (source, status, marcador) por partido.
    const tramos = await tx.unsafe(`
      with ob as (
        select o.match_id, o.source_id, o.status, o.home_score, o.away_score, o.minute, o.observed_at,
          row_number() over (partition by o.match_id order by o.observed_at)
          - row_number() over (partition by o.match_id, o.source_id, o.status, o.home_score, o.away_score order by o.observed_at) g
        from public.observations o where o.match_id = any($1)
      )
      select match_id, source_id, status, home_score, away_score, count(*) n,
        min(observed_at) desde, max(observed_at) hasta, min(minute) min_minute, max(minute) max_minute
      from ob group by match_id, source_id, status, home_score, away_score, g
      order by match_id, desde`, [CASOS]);
    const dec = await tx.unsafe(`
      select match_id, version, status, home_score, away_score, qualifier, rule, decided_at
      from public.decisions where match_id = any($1) order by match_id, version`, [CASOS]);
    const m = await tx.unsafe(`select id, kickoff from public.matches where id = any($1)`, [CASOS]);
    return { ro: ro[0], matches: m, tramos, dec };
  });
  console.log(JSON.stringify(out, null, 1));
} finally { await sql.end({ timeout: 5 }); }

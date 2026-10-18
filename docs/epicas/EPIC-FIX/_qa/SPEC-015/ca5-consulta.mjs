// SPEC-015 CA-5 — consulta de campo, SOLO LECTURA.
// node --env-file=.env docs/epicas/EPIC-FIX/_qa/SPEC-015/ca5-consulta.mjs
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, idle_timeout: 5 });

// Jornada 2026-10-09/12 en hora de Madrid (vie 09 00:00 CEST .. lun 12 24:00 CEST).
const DESDE = "2026-10-08T22:00:00Z";
const HASTA = "2026-10-12T22:00:00Z";

const CA5 = `
with j as (
  select m.id, m.competition_id, m.round, m.kickoff
  from public.matches m
  where m.kickoff >= $1::timestamptz and m.kickoff < $2::timestamptz
),
o as (
  select j.id,
    count(ob.*)                                           as obs,
    count(ob.*) filter (where ob.status = 'live')         as live,
    min(ob.observed_at) filter (where ob.status = 'live') as first_live,
    count(ob.*) filter (where ob.status = 'live'
      and ob.observed_at between j.kickoff - interval '10 min' and j.kickoff + interval '150 min') as live_in_window,
    count(ob.*) filter (where ob.status = 'finished')     as finished_obs,
    string_agg(distinct ob.status, ',')                   as statuses
  from j left join public.observations ob on ob.match_id = j.id
  group by j.id
),
d as (
  select distinct on (match_id) match_id, status as current_status, rule, version
  from public.decisions where match_id in (select id from j)
  order by match_id, version desc
)
select j.id, j.competition_id, j.round, j.kickoff, o.obs, o.live, o.first_live, o.live_in_window,
  o.finished_obs, o.statuses, d.current_status, d.rule as current_rule, d.version,
  (o.first_live < j.kickoff - interval '15 min')                                            as live_temprano,
  ((o.finished_obs > 0 or d.current_status = 'finished') and o.live_in_window = 0)         as finished_sin_live,
  (exists (select 1 from public.decisions dd where dd.match_id = j.id and dd.status = 'finished')
     and o.live_in_window = 0)                                                             as finished_decision_sin_live
from j join o on o.id = j.id left join d on d.match_id = j.id
order by j.kickoff, j.id`;

try {
  const out = await sql.begin("read only", async (tx) => {
    await tx.unsafe("set local statement_timeout = '30s'");
    const ro = await tx.unsafe("select current_setting('transaction_read_only') ro, current_setting('statement_timeout') st, now() now");
    const rows = await tx.unsafe(CA5, [DESDE, HASTA]);
    const loads = await tx.unsafe(
      "select loaded_at from public.calendar_loads where loaded_at >= '2026-10-05T00:00Z' order by loaded_at",
    );
    return { ro: ro[0], rows, loads };
  });
  console.log(JSON.stringify({ desde: DESDE, hasta: HASTA, ...out }, null, 1));
} finally {
  await sql.end({ timeout: 5 });
}

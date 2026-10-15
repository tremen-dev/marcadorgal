select (select count(*) from board where kickoff >= '2026-10-09T18:50:00.000Z' and kickoff <= '2026-10-12T21:30:00.000Z') partidos,
 (select string_agg(distinct season, ',') from board where kickoff >= '2026-10-09T18:50:00.000Z' and kickoff <= '2026-10-12T21:30:00.000Z') temporadas,
 (select count(*) from storage.objects where bucket_id='raw' and name like '%contraste-%') contrastes_guardados

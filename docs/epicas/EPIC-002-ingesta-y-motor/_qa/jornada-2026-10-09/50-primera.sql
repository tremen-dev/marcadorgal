-- R-SPEC-009-1: Primera División en la ventana, sus Decisions y el estado final
select m.id, m.kickoff, count(d.id) decisions, count(*) filter (where d.status='live') d_live,
  count(*) filter (where d.status='finished') d_finished, string_agg(distinct d.rule, ',') reglas,
  b.status final_status, b.home_score||'-'||b.away_score final_sc, b.qualifier, fd.rule final_rule, b.decision_version,
  (select count(*) from observations o where o.match_id=m.id) observations
from matches m left join decisions d on d.match_id=m.id left join board b on b.match_id=m.id left join decisions fd on fd.id=b.decision_id
where m.competition_id='primera-division' and m.kickoff >= '2026-10-09T19:00:00Z' and m.kickoff <= '2026-10-12T21:03:50.522Z'
group by m.id, m.kickoff, b.status, b.home_score, b.away_score, b.qualifier, fd.rule, b.decision_version order by m.kickoff

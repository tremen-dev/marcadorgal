-- SPEC-018 CA-5 (ADR-013 §2, RN-05): sen_sinal also in scheduled, for a match
-- whose kickoff is fifteen minutes gone and that no source gives in play.
-- It only widens the check: every existing row already satisfies it, and
-- finished, postponed and suspended still never carry sen_sinal.
alter table public.decisions drop constraint decisions_sen_sinal_check;
alter table public.decisions add constraint decisions_sen_sinal_check
  check (qualifier <> 'sen_sinal' or status in ('live', 'scheduled'));

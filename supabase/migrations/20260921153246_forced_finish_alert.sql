-- A forced finish (RN-02: kickoff + 120 min with nobody closing the match)
-- publishes a finished nobody confirmed, so it always leaves an Alert behind
-- (SPEC-007 H-5): a false result with a trace is better than one without.
-- Only the kind check changes; the other check of the table (only
-- unresolved_team may lack a match) stays: forced_finish always carries one.
alter table public.alerts drop constraint alerts_kind_check;
alter table public.alerts add constraint alerts_kind_check
  check (kind in ('conflict', 'regression', 'silence', 'unresolved_team', 'forced_finish'));

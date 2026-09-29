-- RN-12, reconciliation after a forced finish (ADR-010 §2, SPEC-013 CA-2): a
-- match closed provisional by the forced finish of RN-02 accepts the final
-- score the source confirms later, recorded with rule RN-12. Only the rule
-- check changes; everything else of decisions stays as
-- 20260920220153_append_only_logs.sql left it.
alter table public.decisions drop constraint decisions_rule_check;
alter table public.decisions add constraint decisions_rule_check
  check (rule in ('operator', 'RN-01', 'RN-02', 'RN-03', 'RN-05', 'RN-12'));

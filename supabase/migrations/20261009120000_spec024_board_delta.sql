-- SPEC-024 CA-1, CA-2 (ADR-014 §5, N-2, H-6): the delta of the board.
--
-- Every new Decision sends the row of web.xornada of its match (exactly its
-- columns, no new read nor a second column list) to the private Broadcast
-- topic board:<season>. The trigger is created DISABLED: while the project is
-- on Free nothing is emitted (H-6). Turning it on is a one-line migration
-- (`alter table public.decisions enable trigger board_delta`) when moving to
-- Pro, before NEXT_PUBLIC_REALTIME=on (N-1).

-- private is outside api.schemas (supabase/config.toml): PostgREST never sees
-- it, and nobody but its owner can use it.
create schema private;
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

-- security definer (N-2): the future operator (EPIC-004) emits without any
-- right on web.xornada. A failure here is the trigger's to swallow.
create function private.send_board_delta(p_match_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_season text;
begin
  select to_jsonb(x), x.season into v_row, v_season
  from web.xornada x
  where x.match_id = p_match_id;
  if v_row is null then
    return;
  end if;
  perform realtime.send(v_row, 'decision', 'board:' || v_season, true);
end
$$;

revoke execute on function private.send_board_delta(text) from public, anon, authenticated;

-- An error while emitting is a warning: it never aborts the Decision (D-9:
-- a transport failure is not the match's business).
create function private.board_delta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform private.send_board_delta(new.match_id);
  exception when others then
    raise warning 'board_delta: match % not sent: %', new.match_id, sqlerrm;
  end;
  return null;
end
$$;

revoke execute on function private.board_delta() from public, anon, authenticated;

create trigger board_delta
after insert on public.decisions
for each row execute function private.board_delta();

-- H-6: solo polling mientras el proyecto siga en Free.
alter table public.decisions disable trigger board_delta;

-- CA-2: anon receives on board:% and nothing else; nobody has INSERT, UPDATE
-- or DELETE, so only the database emits (ADR-014 §5). The row's own topic is
-- checked too: realtime.topic() alone would show every row to whoever set it.
create policy board_receive on realtime.messages
for select
to anon
using (
  extension = 'broadcast'
  and realtime.topic() like 'board:%'
  and topic = realtime.topic()
);

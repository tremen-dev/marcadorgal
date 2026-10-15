select tgname, tgenabled from pg_trigger where tgrelid = 'public.decisions'::regclass and not tgisinternal

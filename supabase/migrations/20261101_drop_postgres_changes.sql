-- Workshop runs on private Broadcast only (20261031_workshop_broadcast.sql). Remove every table from the
-- supabase_realtime publication so Postgres Changes no longer decodes the WAL or streams rows to anyone.
do $$
declare
  t record;
begin
  for t in select schemaname, tablename from pg_publication_tables where pubname = 'supabase_realtime' loop
    execute format('alter publication supabase_realtime drop table %I.%I', t.schemaname, t.tablename);
  end loop;
end $$;

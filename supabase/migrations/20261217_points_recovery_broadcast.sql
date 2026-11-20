-- Points recovery requests push a "refresh" signal on the private workshop:points topic (no customer data in the message).
-- Bar staff (admin, szef, kelner) refetch the list only when something actually changed.

drop trigger if exists points_recovery_workshop_broadcast on public.points_recovery_requests;
create trigger points_recovery_workshop_broadcast
  after insert or update or delete on public.points_recovery_requests
  for each statement execute function private.broadcast_workshop_refresh('workshop:points');

drop policy if exists workshop_broadcast_read on realtime.messages;
create policy workshop_broadcast_read on realtime.messages
  for select to authenticated
  using (
    extension = 'broadcast'
    and (
      ((select realtime.topic()) = 'workshop:orders'
        and (select private.user_role()) = any (array['admin', 'szef', 'kuchnia', 'kelner']))
      or ((select realtime.topic()) = 'workshop:delivery'
        and (select private.user_role()) = 'kierowca')
      or ((select realtime.topic()) = any (array['workshop:menu', 'workshop:settings'])
        and (select private.user_role()) = any (array['admin', 'szef', 'kuchnia', 'kelner', 'kierowca']))
      or ((select realtime.topic()) = 'workshop:points'
        and (select private.user_role()) = any (array['admin', 'szef', 'kelner']))
    )
  );

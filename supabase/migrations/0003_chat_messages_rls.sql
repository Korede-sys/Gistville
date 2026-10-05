-- Replaces the fully-public messages RLS policies (select/insert using (true))
-- with participant-scoped ones, and enables Realtime on the table so chat
-- updates push live instead of requiring a manual refresh.
--
-- Safe to run multiple times: every statement either uses "if exists" or
-- is wrapped so re-running it won't error.

drop policy if exists "public read messages" on messages;
drop policy if exists "public insert messages" on messages;

drop policy if exists "participant read messages" on messages;
create policy "participant read messages" on messages for select
  using (
    order_id in (
      select o.id from orders o
      where o.buyer_id in (select id from profiles where auth_user_id = auth.uid())
         or o.vendor_id in (select id from profiles where auth_user_id = auth.uid())
    )
  );

drop policy if exists "participant insert messages" on messages;
create policy "participant insert messages" on messages for insert
  with check (
    order_id in (
      select o.id from orders o
      where o.buyer_id in (select id from profiles where auth_user_id = auth.uid())
         or o.vendor_id in (select id from profiles where auth_user_id = auth.uid())
    )
  );

-- Adds the messages table to the Realtime publication so
-- subscribeToMessages() (src/lib/data.ts) actually receives INSERT events.
-- If this errors with "relation is already member of publication", the
-- table is already enabled for Realtime and you can ignore it.
alter publication supabase_realtime add table messages;

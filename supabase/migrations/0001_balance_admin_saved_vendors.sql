-- Run this once against your LIVE Supabase project's SQL editor (not just
-- the reference schema.sql, which is for a fresh install only). Safe to
-- run multiple times — everything here is idempotent (`create or replace`,
-- `if not exists`).
--
-- Covers:
--   1. saved_vendors table (buyer bookmarks) + RLS
--   2. admin_users table (real per-admin auth) + RLS
--   3. vendor_available_balance() — identity check + order revenue fix

-- 1. Saved vendors ------------------------------------------------------
create table if not exists saved_vendors (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references profiles(id) on delete cascade,
  vendor_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (buyer_id, vendor_id)
);
alter table saved_vendors enable row level security;

drop policy if exists "buyer read own saved vendors" on saved_vendors;
create policy "buyer read own saved vendors" on saved_vendors for select
  using (buyer_id in (select id from profiles where auth_user_id = auth.uid()));

drop policy if exists "buyer save own saved vendors" on saved_vendors;
create policy "buyer save own saved vendors" on saved_vendors for insert
  with check (buyer_id in (select id from profiles where auth_user_id = auth.uid()));

drop policy if exists "buyer unsave own saved vendors" on saved_vendors;
create policy "buyer unsave own saved vendors" on saved_vendors for delete
  using (buyer_id in (select id from profiles where auth_user_id = auth.uid()));

-- 2. Admin users (real per-admin auth) ----------------------------------
create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table admin_users enable row level security;
-- Intentionally no policies — only readable/writable via the service-role
-- key from api/admin/*.ts.

-- 3. vendor_available_balance() fix -------------------------------------
create or replace function vendor_available_balance(p_vendor_id uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  v_result numeric;
begin
  if auth.role() <> 'service_role' and not exists (
    select 1 from profiles where id = p_vendor_id and auth_user_id = auth.uid()
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select
    coalesce((select sum(vendor_earning_ngn) from gift_transactions where recipient_id = p_vendor_id), 0)
    + coalesce((select sum(amount * 0.95) from orders where vendor_id = p_vendor_id and paid = true), 0)
    - coalesce((select sum(amount_ngn) from payouts where vendor_id = p_vendor_id and status in ('pending','success')), 0)
  into v_result;

  return v_result;
end;
$$;
revoke all on function vendor_available_balance(uuid) from public, anon;
grant execute on function vendor_available_balance(uuid) to authenticated, service_role;

-- After running this, bootstrap your first admin:
--   1. Sign up/log in as a normal user in the deployed app.
--   2. POST to /api/admin/bootstrap-admin with your session's bearer token
--      and {"code": "<your ADMIN_ACCESS_CODE>"} — the admin login screen at
--      /admin/disputes does this for you automatically when it detects
--      your account isn't an admin yet.

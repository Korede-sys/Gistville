-- GistVille — consolidated schema (verified against the live project's
-- actual information_schema before writing this file — not reconstructed
-- from memory alone). Run this on a fresh Supabase project.

create extension if not exists "pgcrypto";

create table profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  role text not null check (role in ('vendor','buyer')),
  name text not null,
  email text,
  phone text,
  business_name text,
  category text,
  area text,
  verified boolean not null default false,
  verified_until timestamptz,
  coin_balance integer not null default 0,
  rating numeric(2,1) not null default 5.0,
  reviews integer not null default 0,
  price_from text,
  gradient text,
  availability_status text not null default 'open' check (availability_status in ('open','busy')),
  availability_detail text,
  bank_code text,
  bank_name text,
  account_number text,
  account_name text,
  paystack_recipient_code text,
  country text,
  payment_provider text check (payment_provider in ('paystack','stripe')),
  stripe_account_id text,
  created_at timestamptz not null default now()
);

create table vendor_menu_items (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references profiles(id) on delete cascade,
  item text not null,
  price text not null,
  sort_order integer not null default 0
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references profiles(id) on delete cascade,
  buyer_id uuid references profiles(id) on delete set null,
  buyer_name text not null,
  buyer_phone text,
  description text not null,
  amount numeric(10,2) not null,
  currency text not null default 'NGN',
  status text not null default 'pending' check (status in ('pending','in_progress','ready','completed')),
  paid boolean not null default false,
  paystack_reference text,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  sender text not null check (sender in ('buyer','vendor')),
  text text not null,
  created_at timestamptz not null default now()
);

create table vendor_requests (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  poster_name text not null,
  area text not null,
  response_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  reason text not null,
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now()
);

create table waitlist (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  role text not null check (role in ('vendor','buyer')),
  category text,
  area text not null,
  created_at timestamptz not null default now()
);

create table listings (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references profiles(id) on delete cascade,
  media_type text not null check (media_type in ('photo','video')),
  media_url text not null,
  caption text not null,
  price text not null,
  created_at timestamptz not null default now()
);

create table ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references profiles(id) on delete cascade,
  listing_id uuid not null references listings(id) on delete cascade,
  budget numeric(10,2) not null,
  spent numeric(10,2) not null default 0,
  impressions integer not null default 0,
  clicks integer not null default 0,
  status text not null default 'active' check (status in ('active','paused','completed')),
  currency text not null default 'NGN',
  created_at timestamptz not null default now()
);

create table vendor_subscriptions (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references profiles(id) on delete cascade unique,
  status text not null default 'inactive' check (status in ('active','inactive','past_due')),
  current_period_end timestamptz,
  paystack_subscription_code text,
  paystack_customer_code text,
  paystack_email_token text,
  currency text not null default 'NGN',
  created_at timestamptz not null default now()
);

create table gift_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text not null,
  coin_cost integer not null,
  sort_order integer not null default 0,
  active boolean not null default true
);

create table coin_purchases (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references profiles(id) on delete cascade,
  coins integer not null,
  amount_ngn numeric(10,2) not null,
  paystack_reference text,
  created_at timestamptz not null default now()
);

create table gift_transactions (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references profiles(id) on delete cascade,
  recipient_id uuid not null references profiles(id) on delete cascade,
  gift_id uuid not null references gift_catalog(id),
  coin_cost integer not null,
  vendor_earning_ngn numeric(10,2) not null,
  platform_fee_ngn numeric(10,2) not null,
  created_at timestamptz not null default now()
);

create table payouts (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references profiles(id) on delete cascade,
  amount_ngn numeric(10,2) not null,
  status text not null default 'pending' check (status in ('pending','success','failed')),
  paystack_transfer_code text,
  paystack_reference text,
  stripe_transfer_id text,
  failure_reason text,
  currency text not null default 'NGN',
  created_at timestamptz not null default now()
);

create table app_settings (
  key text primary key,
  value text not null
);

-- Real per-admin auth (replaces the shared ADMIN_ACCESS_CODE as the ongoing
-- access control). A normal Supabase-authenticated user becomes an admin by
-- being added here; RLS has no policies on this table at all, so it is only
-- ever readable/writable via the service-role key from api/admin/*.ts — not
-- from the client, and not even from an authenticated user's own session.
create table saved_vendors (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references profiles(id) on delete cascade,
  vendor_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (buyer_id, vendor_id)
);
alter table saved_vendors enable row level security;
create policy "buyer read own saved vendors" on saved_vendors for select
  using (buyer_id in (select id from profiles where auth_user_id = auth.uid()));
create policy "buyer save own saved vendors" on saved_vendors for insert
  with check (buyer_id in (select id from profiles where auth_user_id = auth.uid()));
create policy "buyer unsave own saved vendors" on saved_vendors for delete
  using (buyer_id in (select id from profiles where auth_user_id = auth.uid()));

create table admin_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table admin_users enable row level security;

insert into storage.buckets (id, name, public)
values ('listings', 'listings', true)
on conflict (id) do nothing;

create policy "public read listing media" on storage.objects
  for select using (bucket_id = 'listings');
create policy "authenticated user upload own listing media" on storage.objects
  for insert with check (bucket_id = 'listings' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "authenticated user delete own listing media" on storage.objects
  for delete using (bucket_id = 'listings' and (storage.foldername(name))[1] = auth.uid()::text);

alter table profiles enable row level security;
alter table vendor_menu_items enable row level security;
alter table orders enable row level security;
alter table messages enable row level security;
alter table vendor_requests enable row level security;
alter table disputes enable row level security;
alter table waitlist enable row level security;
alter table listings enable row level security;
alter table ad_campaigns enable row level security;
alter table vendor_subscriptions enable row level security;
alter table gift_catalog enable row level security;
alter table coin_purchases enable row level security;
alter table gift_transactions enable row level security;
alter table payouts enable row level security;
alter table app_settings enable row level security;

create policy "public read profiles" on profiles for select using (true);
create policy "user insert own profile" on profiles for insert with check (auth_user_id = auth.uid());
create policy "user update own profile" on profiles for update using (auth_user_id = auth.uid());

create policy "public read menu items" on vendor_menu_items for select using (true);

create policy "buyer or vendor read own orders" on orders for select
  using (
    buyer_id in (select id from profiles where auth_user_id = auth.uid())
    or vendor_id in (select id from profiles where auth_user_id = auth.uid())
  );
create policy "buyer insert own orders" on orders for insert
  with check (buyer_id in (select id from profiles where auth_user_id = auth.uid()));
create policy "vendor update own orders" on orders for update
  using (vendor_id in (select id from profiles where auth_user_id = auth.uid()));

create policy "public read messages" on messages for select using (true);
create policy "public insert messages" on messages for insert with check (true);

create policy "public read requests" on vendor_requests for select using (true);
create policy "public insert requests" on vendor_requests for insert with check (true);

create policy "public insert disputes" on disputes for insert with check (true);
create policy "vendor read disputes on own orders" on disputes for select
  using (
    order_id in (
      select o.id from orders o join profiles p on p.id = o.vendor_id
      where p.auth_user_id = auth.uid()
    )
  );

create policy "public insert waitlist" on waitlist for insert with check (true);

create policy "public read listings" on listings for select using (true);
create policy "vendor manage own listings" on listings for insert
  with check (vendor_id in (select id from profiles where auth_user_id = auth.uid()));
create policy "vendor update own listings" on listings for update
  using (vendor_id in (select id from profiles where auth_user_id = auth.uid()));

create policy "vendor read own ads" on ad_campaigns for select
  using (vendor_id in (select id from profiles where auth_user_id = auth.uid()));
create policy "vendor create own ads" on ad_campaigns for insert
  with check (vendor_id in (select id from profiles where auth_user_id = auth.uid()));
create policy "vendor update own ads" on ad_campaigns for update
  using (vendor_id in (select id from profiles where auth_user_id = auth.uid()));

create policy "vendor read own subscription" on vendor_subscriptions for select
  using (vendor_id in (select id from profiles where auth_user_id = auth.uid()));
create policy "vendor upsert own subscription" on vendor_subscriptions for insert
  with check (vendor_id in (select id from profiles where auth_user_id = auth.uid()));
create policy "vendor update own subscription" on vendor_subscriptions for update
  using (vendor_id in (select id from profiles where auth_user_id = auth.uid()));

create policy "public read gift catalog" on gift_catalog for select using (active = true);

create policy "buyer read own coin purchases" on coin_purchases for select
  using (buyer_id in (select id from profiles where auth_user_id = auth.uid()));

create policy "sender or recipient read gift transactions" on gift_transactions for select
  using (
    sender_id in (select id from profiles where auth_user_id = auth.uid())
    or recipient_id in (select id from profiles where auth_user_id = auth.uid())
  );

create policy "vendor read own payouts" on payouts for select
  using (vendor_id in (select id from profiles where auth_user_id = auth.uid()));

create or replace function increment_ad_impression(campaign_id uuid, cost numeric)
returns void language sql security definer set search_path = public as $$
  update ad_campaigns
  set impressions = impressions + 1, spent = least(budget, spent + cost)
  where id = campaign_id and status = 'active';
$$;

create or replace function increment_ad_click(campaign_id uuid)
returns void language sql security definer set search_path = public as $$
  update ad_campaigns set clicks = clicks + 1 where id = campaign_id and status = 'active';
$$;

grant execute on function increment_ad_impression(uuid, numeric) to anon, authenticated;
grant execute on function increment_ad_click(uuid) to anon, authenticated;

-- Coin minting — service role ONLY. A real security bug was found and
-- fixed here: Supabase grants EXECUTE on new functions to anon/authenticated
-- by default, and revoking from PUBLIC alone does not undo that — the
-- explicit per-role revoke below is required, not optional.
create or replace function add_coins(profile_id uuid, amount integer)
returns void language sql security definer set search_path = public as $$
  update profiles set coin_balance = coin_balance + amount where id = profile_id;
$$;
revoke execute on function add_coins(uuid, integer) from anon;
revoke execute on function add_coins(uuid, integer) from authenticated;

create or replace function send_gift(p_sender_id uuid, p_recipient_id uuid, p_gift_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cost integer;
  v_balance integer;
  v_value_ngn numeric(10,2);
  v_vendor_earning numeric(10,2);
  v_platform_fee numeric(10,2);
  v_txn_id uuid;
begin
  select coin_cost into v_cost from gift_catalog where id = p_gift_id and active = true;
  if v_cost is null then
    return jsonb_build_object('ok', false, 'error', 'Unknown gift');
  end if;

  select coin_balance into v_balance from profiles where id = p_sender_id for update;
  if v_balance is null or v_balance < v_cost then
    return jsonb_build_object('ok', false, 'error', 'Not enough coins');
  end if;

  update profiles set coin_balance = coin_balance - v_cost where id = p_sender_id;

  v_value_ngn := v_cost * 10;
  v_vendor_earning := round(v_value_ngn * 0.7, 2);
  v_platform_fee := v_value_ngn - v_vendor_earning;

  insert into gift_transactions (sender_id, recipient_id, gift_id, coin_cost, vendor_earning_ngn, platform_fee_ngn)
  values (p_sender_id, p_recipient_id, p_gift_id, v_cost, v_vendor_earning, v_platform_fee)
  returning id into v_txn_id;

  return jsonb_build_object('ok', true, 'transaction_id', v_txn_id, 'vendor_earning_ngn', v_vendor_earning);
end;
$$;
grant execute on function send_gift(uuid, uuid, uuid) to anon, authenticated;

-- Identity-checked: only the vendor themselves (matched via auth.uid()) or
-- the server's service-role key (used by api/paystack/payout.ts, which has
-- already authenticated the vendor independently via their bearer token)
-- can read a vendor's balance. Previously any caller who knew a vendor's
-- profile id could read it — not a money-moving risk (the payout endpoint
-- independently re-verifies identity before paying out), but a privacy gap.
-- Also folds in order revenue (95% vendor / 5% platform on paid orders),
-- not just gift earnings (70% vendor / 30% platform), matching the actual
-- payout split documented in the README.
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

insert into profiles (role, name, business_name, category, area, rating, reviews, verified, price_from, gradient, availability_status, availability_detail)
values
  ('vendor', 'Amaka''s Stitch House', 'Amaka''s Stitch House', 'Tailoring', 'Wuse 2', 4.8, 62, true, '₦8,000+', 'linear-gradient(135deg, #2B4C7E, #1E3760)', 'busy', 'Booked until Aug 20'),
  ('vendor', 'Glow by Tolu', 'Glow by Tolu', 'Makeup artist', 'Garki', 4.9, 104, true, '₦15,000+', 'linear-gradient(135deg, #D4A017, #96760F)', 'open', 'Available this week'),
  ('vendor', 'Gele Queen NG', 'Gele Queen NG', 'Aso-ebi & Gele', 'Lugbe', 4.6, 31, false, '₦5,000+', 'linear-gradient(135deg, #1F7A4D, #14532d)', 'open', 'Available this week');

insert into vendor_menu_items (vendor_id, item, price, sort_order)
select id, item, price, sort_order from (
  values
    ('Amaka''s Stitch House', 'Ankara gown (simple)', '₦8,000', 1),
    ('Amaka''s Stitch House', 'Aso-ebi gown + gele combo', '₦18,000', 2),
    ('Amaka''s Stitch House', 'Native wear (men)', '₦12,000', 3),
    ('Glow by Tolu', 'Bridal makeup', '₦35,000', 1),
    ('Glow by Tolu', 'Party makeup', '₦15,000', 2),
    ('Glow by Tolu', 'Makeup + gele styling', '₦22,000', 3),
    ('Gele Queen NG', 'Gele tying (single)', '₦5,000', 1),
    ('Gele Queen NG', 'Gele + head-tie set', '₦9,000', 2)
) as seed(vendor_name, item, price, sort_order)
join profiles on profiles.business_name = seed.vendor_name and profiles.role = 'vendor';

insert into gift_catalog (name, emoji, coin_cost, sort_order) values
  ('Rose', '🌹', 10, 1),
  ('Heart', '❤️', 20, 2),
  ('Bouquet', '💐', 50, 3),
  ('Diamond', '💎', 200, 4),
  ('Crown', '👑', 500, 5);

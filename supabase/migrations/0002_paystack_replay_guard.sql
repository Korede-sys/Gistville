-- Run this once against your LIVE Supabase project's SQL editor. Safe to
-- run multiple times (`create table if not exists`).
--
-- Closes a payment-replay hole in api/paystack/verify.ts: previously, a
-- single successful Paystack payment reference could be submitted to
-- /api/paystack/verify more than once (for the same or a different
-- orderId/vendorId/buyerId) and would be accepted every time, since
-- nothing checked whether that reference had already been consumed. That
-- would let someone mark unlimited orders "paid", repeatedly re-extend
-- their verified badge, or mint coin packages for free from one real
-- payment. This table is the single-use ledger that closes it — see the
-- updated api/paystack/verify.ts for how it's used.

create table if not exists paystack_transactions (
  reference text primary key,
  purpose text not null,
  created_at timestamptz not null default now()
);
alter table paystack_transactions enable row level security;
-- No policies — service-role only (api/paystack/verify.ts).

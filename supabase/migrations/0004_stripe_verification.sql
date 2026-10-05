-- Adds the columns needed for Stripe-side vendor verification
-- subscriptions (api/stripe/verification-checkout.ts +
-- api/stripe/webhook.ts), so European (and other non-Paystack-country)
-- vendors can subscribe to the verified badge the same way Paystack
-- vendors already could.
--
-- Safe to run multiple times — every statement uses "if not exists".

alter table vendor_subscriptions add column if not exists stripe_subscription_id text;
alter table vendor_subscriptions add column if not exists stripe_customer_id text;

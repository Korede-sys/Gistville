// Setup required after deploying: in the Stripe dashboard -> Developers ->
// Webhooks, add an endpoint at https://<your-domain>/api/stripe/webhook
// listening for: checkout.session.completed, account.updated,
// invoice.payment_succeeded, invoice.payment_failed,
// customer.subscription.deleted

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Looks up the vendor a subscription belongs to via the metadata set at
// creation time in api/stripe/verification-checkout.ts (subscription_data.
// metadata), falling back to matching on stripe_customer_id for events
// where Stripe doesn't echo metadata back (older API shapes / some invoice
// payloads only carry the customer, not the subscription's metadata).
async function resolveVendorId(
  stripe: Stripe,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  subscriptionId: string | null,
  customerId: string | null
): Promise<string | null> {
  if (subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const vendorId = sub.metadata?.vendorId;
      if (vendorId) return vendorId;
    } catch {
      // fall through to customer lookup
    }
  }
  if (customerId) {
    const { data } = await supabase
      .from("vendor_subscriptions")
      .select("vendor_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    if (data?.vendor_id) return data.vendor_id as string;
  }
  return null;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!stripeSecret || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Server not fully configured." }), { status: 500 });
  }

  const stripe = new Stripe(stripeSecret);
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.mode === "subscription" && session.metadata?.purpose === "verification") {
        const vendorId = session.metadata?.vendorId;
        const subscriptionId = session.subscription as string | null;
        if (vendorId && subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const periodEnd = new Date(sub.current_period_end * 1000).toISOString();
          await supabase.from("vendor_subscriptions").upsert(
            {
              vendor_id: vendorId,
              status: "active",
              current_period_end: periodEnd,
              stripe_subscription_id: subscriptionId,
              stripe_customer_id: session.customer as string,
            },
            { onConflict: "vendor_id" }
          );
          await supabase
            .from("profiles")
            .update({ verified: true, verified_until: periodEnd })
            .eq("id", vendorId);
        }
        break;
      }

      const orderId = session.metadata?.orderId;
      if (orderId) {
        await supabase
          .from("orders")
          .update({ paid: true, stripe_payment_intent_id: session.payment_intent as string })
          .eq("id", orderId);
      }
      break;
    }

    // Renewal charges. The initial charge is handled by
    // checkout.session.completed above; this is what keeps verified_until
    // moving forward every month after that.
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = (invoice.subscription as string | null) ?? null;
      const customerId = (invoice.customer as string | null) ?? null;
      if (subscriptionId) {
        const vendorId = await resolveVendorId(stripe, supabase, subscriptionId, customerId);
        if (vendorId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const periodEnd = new Date(sub.current_period_end * 1000).toISOString();
          await supabase
            .from("vendor_subscriptions")
            .update({ status: "active", current_period_end: periodEnd, stripe_subscription_id: subscriptionId })
            .eq("vendor_id", vendorId);
          await supabase
            .from("profiles")
            .update({ verified: true, verified_until: periodEnd })
            .eq("id", vendorId);
        }
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = (invoice.subscription as string | null) ?? null;
      const customerId = (invoice.customer as string | null) ?? null;
      const vendorId = await resolveVendorId(stripe, supabase, subscriptionId, customerId);
      if (vendorId) {
        await supabase.from("vendor_subscriptions").update({ status: "past_due" }).eq("vendor_id", vendorId);
      }
      break;
    }

    // Grace period, same as Paystack's "subscription.disable" handling:
    // don't revoke the verified badge immediately. Only mark the
    // subscription inactive — profiles.verified_until (set on the last
    // successful charge) keeps running out on its own, so the badge
    // disappears naturally at the end of the period already paid for. See
    // src/lib/verification.ts, which every surface displaying the badge
    // reads through instead of the raw `verified` column.
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const vendorId = await resolveVendorId(stripe, supabase, sub.id, sub.customer as string);
      if (vendorId) {
        await supabase.from("vendor_subscriptions").update({ status: "inactive" }).eq("vendor_id", vendorId);
      }
      break;
    }

    case "account.updated": {
      break;
    }

    default:
      break;
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}

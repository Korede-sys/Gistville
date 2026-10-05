import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { authenticateVendor } from "../_lib/authenticateVendor";

// Mirrors VERIFICATION_FEE_STRIPE in src/lib/payments.ts — kept in sync
// manually since api/*.ts can't import from src/ in this Vercel setup.
// Deliberately NOT trusted from the client: a request can only choose
// which currency to be billed in, never the amount — the amount is always
// looked up here from the currency, same pattern as api/paystack/verify.ts.
const VERIFICATION_FEE_BY_CURRENCY: Record<string, number> = {
  USD: 2,
  GBP: 2,
  EUR: 2,
  CAD: 3,
  AUD: 3,
  INR: 150,
  PLN: 8,
  SEK: 20,
  DKK: 14,
  CHF: 2,
  NOK: 20,
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const vendor = await authenticateVendor(req);
  if (!vendor) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!stripeSecret || !supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Server not fully configured." }), { status: 500 });
  }

  let body: { currency?: string; successUrl?: string; cancelUrl?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }

  const requested = (body.currency || "USD").toUpperCase();
  const currency = VERIFICATION_FEE_BY_CURRENCY[requested] ? requested : "USD";
  const amount = VERIFICATION_FEE_BY_CURRENCY[currency];

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const stripe = new Stripe(stripeSecret);

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, business_name")
    .eq("id", vendor.profileId)
    .single();

  const { data: existingSub } = await supabase
    .from("vendor_subscriptions")
    .select("stripe_customer_id, status")
    .eq("vendor_id", vendor.profileId)
    .maybeSingle();

  if (existingSub?.status === "active") {
    return new Response(JSON.stringify({ error: "You're already verified and subscribed." }), { status: 400 });
  }

  let customerId = existingSub?.stripe_customer_id as string | undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email ?? undefined,
      name: profile?.business_name ?? undefined,
      metadata: { vendorId: vendor.profileId },
    });
    customerId = customer.id;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: currency.toLowerCase(),
          unit_amount: Math.round(amount * 100),
          recurring: { interval: "month" },
          product_data: { name: "GistVille vendor verification" },
        },
        quantity: 1,
      },
    ],
    success_url: body.successUrl ?? "https://example.com/",
    cancel_url: body.cancelUrl ?? "https://example.com/",
    metadata: { vendorId: vendor.profileId, purpose: "verification" },
    subscription_data: { metadata: { vendorId: vendor.profileId, purpose: "verification" } },
  });

  // Save the customer id (and the currency actually being charged) right
  // away so a returning vendor reuses the same Stripe customer next time,
  // even if they close the tab before the webhook ever fires.
  await supabase
    .from("vendor_subscriptions")
    .upsert(
      { vendor_id: vendor.profileId, stripe_customer_id: customerId, currency },
      { onConflict: "vendor_id" }
    );

  return new Response(JSON.stringify({ ok: true, url: session.url }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

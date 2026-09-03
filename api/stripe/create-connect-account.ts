import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { authenticateVendor } from "../_lib/authenticateVendor";

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

  let body: { returnUrl?: string; refreshUrl?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }

  const stripe = new Stripe(stripeSecret);
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_account_id, email, country, business_name")
    .eq("id", vendor.profileId)
    .single();

  let accountId = profile?.stripe_account_id as string | undefined;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: profile?.country || "US",
      email: profile?.email ?? undefined,
      business_type: "individual",
      capabilities: { transfers: { requested: true }, card_payments: { requested: true } },
    });
    accountId = account.id;
    await supabase.from("profiles").update({ stripe_account_id: accountId }).eq("id", vendor.profileId);
  }

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    return_url: body.returnUrl ?? "https://example.com/vendor/gifts",
    refresh_url: body.refreshUrl ?? "https://example.com/vendor/gifts",
  });

  return new Response(JSON.stringify({ ok: true, onboardingUrl: accountLink.url }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

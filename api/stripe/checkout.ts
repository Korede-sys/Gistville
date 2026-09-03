import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const PLATFORM_FEE_RATE = 0.05;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!stripeSecret || !supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Server not fully configured." }), { status: 500 });
  }

  let body: { orderId?: string; successUrl?: string; cancelUrl?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }
  if (!body.orderId) return new Response(JSON.stringify({ error: "Missing orderId" }), { status: 400 });

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: order } = await supabase
    .from("orders")
    .select("id, description, amount, currency, vendor_id, profiles(stripe_account_id, business_name)")
    .eq("id", body.orderId)
    .single();

  if (!order) return new Response(JSON.stringify({ error: "Order not found" }), { status: 404 });

  const vendorProfile = order.profiles as unknown as { stripe_account_id: string | null; business_name: string };
  if (!vendorProfile?.stripe_account_id) {
    return new Response(
      JSON.stringify({ error: "This vendor hasn't finished setting up payouts yet." }),
      { status: 400 }
    );
  }

  const stripe = new Stripe(stripeSecret);
  const amountCents = Math.round(Number(order.amount) * 100);
  const applicationFee = Math.round(amountCents * PLATFORM_FEE_RATE);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: (order.currency || "USD").toLowerCase(),
          unit_amount: amountCents,
          product_data: { name: order.description ?? "GistVille order" },
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      application_fee_amount: applicationFee,
      transfer_data: { destination: vendorProfile.stripe_account_id },
    },
    success_url: body.successUrl ?? "https://example.com/",
    cancel_url: body.cancelUrl ?? "https://example.com/",
    metadata: { orderId: order.id },
  });

  return new Response(JSON.stringify({ ok: true, url: session.url }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

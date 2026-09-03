// Setup required after deploying: in the Stripe dashboard -> Developers ->
// Webhooks, add an endpoint at https://<your-domain>/api/stripe/webhook
// listening for: checkout.session.completed, account.updated

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

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
      const orderId = session.metadata?.orderId;
      if (orderId) {
        await supabase
          .from("orders")
          .update({ paid: true, stripe_payment_intent_id: session.payment_intent as string })
          .eq("id", orderId);
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

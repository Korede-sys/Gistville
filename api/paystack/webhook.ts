// Setup required after deploying: in the Paystack dashboard -> Settings ->
// API Keys & Webhooks, set the webhook URL to
// https://<your-domain>/api/paystack/webhook

import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "edge" };

async function verifySignature(rawBody: string, signature: string, secretKey: string): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secretKey),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const computedHex = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return computedHex === signature;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secretKey || !supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Server not fully configured." }), { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature") ?? "";
  const validSignature = await verifySignature(rawBody, signature, secretKey);
  if (!validSignature) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const email: string | undefined = event.data?.customer?.email;
  const vendorProfile = email
    ? (
        await supabase.from("profiles").select("id").eq("email", email).eq("role", "vendor").single()
      ).data
    : null;

  switch (event.event) {
    case "subscription.create": {
      if (vendorProfile) {
        await supabase.from("vendor_subscriptions").upsert({
          vendor_id: vendorProfile.id,
          status: "active",
          paystack_subscription_code: event.data.subscription_code,
          paystack_customer_code: event.data.customer?.customer_code,
          paystack_email_token: event.data.email_token,
        });
      }
      break;
    }

    case "charge.success": {
      if (vendorProfile && event.data.plan) {
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        await supabase.from("vendor_subscriptions").upsert({
          vendor_id: vendorProfile.id,
          status: "active",
          current_period_end: periodEnd.toISOString(),
        });
        await supabase
          .from("profiles")
          .update({ verified: true, verified_until: periodEnd.toISOString() })
          .eq("id", vendorProfile.id);
      }
      break;
    }

    case "invoice.payment_failed": {
      if (vendorProfile) {
        await supabase
          .from("vendor_subscriptions")
          .update({ status: "past_due" })
          .eq("vendor_id", vendorProfile.id);
      }
      break;
    }

    case "subscription.disable": {
      // Grace period: don't revoke the verified badge immediately. Only
      // mark the subscription inactive here — `profiles.verified` stays
      // true and `verified_until` (set on the last successful charge)
      // keeps running out on its own, so the badge disappears naturally at
      // the end of the period the vendor already paid for, not the instant
      // Paystack reports the cancellation. See src/lib/verification.ts,
      // which every surface that displays the badge reads through instead
      // of the raw `verified` column.
      if (vendorProfile) {
        await supabase
          .from("vendor_subscriptions")
          .update({ status: "inactive" })
          .eq("vendor_id", vendorProfile.id);
      }
      break;
    }

    default:
      break;
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}

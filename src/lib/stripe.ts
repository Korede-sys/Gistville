import { supabase } from "./supabase";

async function authedFetch(path: string, body?: unknown) {
  if (!supabase) return { ok: false, error: "Not connected." };
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "You're not logged in." };

  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: data.error ?? "Request failed." };
  return data;
}

export async function startStripeOnboarding(): Promise<{ ok: boolean; error?: string; onboardingUrl?: string }> {
  return authedFetch("/api/stripe/create-connect-account", {
    returnUrl: `${window.location.origin}/vendor/gifts?stripe_onboarded=1`,
    refreshUrl: `${window.location.origin}/vendor/gifts`,
  });
}

export async function startStripeVerification(
  currency: string
): Promise<{ ok: boolean; error?: string; url?: string }> {
  const base = window.location.href.split("?")[0];
  return authedFetch("/api/stripe/verification-checkout", {
    currency,
    successUrl: `${base}?stripe_verification=1`,
    cancelUrl: base,
  });
}

// This call itself doesn't check who's asking - it doesn't need to, since
// it only operates on an orderId that must already exist. Buyer login is
// actually enforced earlier, at order creation (createOrder() in
// src/lib/data.ts), by the orders RLS insert policy requiring a real
// buyer_id - that gate applies the same way regardless of which provider
// ends up processing the payment.
export async function createStripeCheckout(
  orderId: string
): Promise<{ ok: boolean; error?: string; url?: string }> {
  try {
    const base = window.location.href.split("?")[0];
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        successUrl: `${base}?stripe_success=1&order_id=${orderId}`,
        cancelUrl: base,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error ?? "Couldn't start checkout." };
    return { ok: true, url: data.url };
  } catch {
    return { ok: false, error: "Couldn't reach the checkout server." };
  }
}

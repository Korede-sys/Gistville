import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secretKey || !supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Server not fully configured. See README for required env vars." }),
      { status: 500 }
    );
  }

  let body: {
    reference?: string;
    purpose?: "order" | "verification" | "coins";
    orderId?: string;
    vendorId?: string;
    buyerId?: string;
    coins?: number;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }

  const { reference, purpose, orderId, vendorId, buyerId, coins } = body;
  if (!reference || !purpose) {
    return new Response(JSON.stringify({ error: "Missing reference or purpose" }), { status: 400 });
  }

  const psRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const psData = await psRes.json();

  if (!psRes.ok || psData?.data?.status !== "success") {
    return new Response(JSON.stringify({ ok: false, error: "Payment not confirmed by Paystack." }), {
      status: 402,
    });
  }

  const amountKobo: number = psData.data.amount;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  if (purpose === "order") {
    if (!orderId) return new Response(JSON.stringify({ error: "Missing orderId" }), { status: 400 });

    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("id, amount, paid")
      .eq("id", orderId)
      .single();

    if (fetchErr || !order) {
      return new Response(JSON.stringify({ ok: false, error: "Order not found" }), { status: 404 });
    }
    const expectedKobo = Math.round(Number(order.amount) * 100);
    if (amountKobo !== expectedKobo) {
      return new Response(
        JSON.stringify({ ok: false, error: "Charged amount doesn't match order amount." }),
        { status: 402 }
      );
    }

    const { error: updateErr } = await supabase
      .from("orders")
      .update({ paid: true, paystack_reference: reference })
      .eq("id", orderId);
    if (updateErr) {
      return new Response(JSON.stringify({ ok: false, error: updateErr.message }), { status: 500 });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  if (purpose === "verification") {
    if (!vendorId) return new Response(JSON.stringify({ error: "Missing vendorId" }), { status: 400 });

    const expectedKobo = 1000 * 100;
    if (amountKobo !== expectedKobo) {
      return new Response(JSON.stringify({ ok: false, error: "Unexpected charge amount." }), {
        status: 402,
      });
    }

    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const { error: subErr } = await supabase.from("vendor_subscriptions").upsert({
      vendor_id: vendorId,
      status: "active",
      current_period_end: periodEnd.toISOString(),
    });
    if (subErr) return new Response(JSON.stringify({ ok: false, error: subErr.message }), { status: 500 });

    const { error: profErr } = await supabase
      .from("profiles")
      .update({ verified: true, verified_until: periodEnd.toISOString() })
      .eq("id", vendorId);
    if (profErr) return new Response(JSON.stringify({ ok: false, error: profErr.message }), { status: 500 });

    return new Response(JSON.stringify({ ok: true, current_period_end: periodEnd.toISOString() }), {
      status: 200,
    });
  }

  if (purpose === "coins") {
    if (!buyerId || !coins) {
      return new Response(JSON.stringify({ error: "Missing buyerId or coins" }), { status: 400 });
    }

    const COIN_PACKAGES = [
      { coins: 100, priceNgn: 1000 },
      { coins: 550, priceNgn: 5000 },
      { coins: 1200, priceNgn: 10000 },
    ];
    const pkg = COIN_PACKAGES.find((p) => p.coins === coins);
    if (!pkg || amountKobo !== pkg.priceNgn * 100) {
      return new Response(JSON.stringify({ ok: false, error: "Unrecognized coin package or amount." }), {
        status: 402,
      });
    }

    const { error: coinErr } = await supabase.rpc("add_coins", { profile_id: buyerId, amount: coins });
    if (coinErr) return new Response(JSON.stringify({ ok: false, error: coinErr.message }), { status: 500 });

    await supabase.from("coin_purchases").insert({
      buyer_id: buyerId,
      coins,
      amount_ngn: pkg.priceNgn,
      paystack_reference: reference,
    });

    const { data: prof } = await supabase.from("profiles").select("coin_balance").eq("id", buyerId).single();

    return new Response(JSON.stringify({ ok: true, newBalance: prof?.coin_balance }), { status: 200 });
  }

  return new Response(JSON.stringify({ error: "Unknown purpose" }), { status: 400 });
}

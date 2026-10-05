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

  // Single-use guard: a payment reference can only ever be consumed once,
  // for one purpose. Without this, Paystack confirming "success" on a
  // reference doesn't stop that same reference being replayed against this
  // endpoint again — which would let someone mark unlimited orders paid,
  // re-extend their verified badge, or mint coins repeatedly from a single
  // real payment. The insert's primary-key conflict IS the atomic check.
  // If something downstream turns out to be a legitimate failure (order
  // not found, amount mismatch, a DB error) rather than an actual replay,
  // `fail()` releases the claim again so a genuine retry with the same
  // reference still works.
  const { error: replayErr } = await supabase
    .from("paystack_transactions")
    .insert({ reference, purpose });
  if (replayErr) {
    return new Response(
      JSON.stringify({ ok: false, error: "This payment has already been processed." }),
      { status: 409 }
    );
  }

  const fail = async (status: number, message: string): Promise<Response> => {
    await supabase.from("paystack_transactions").delete().eq("reference", reference);
    return new Response(JSON.stringify({ ok: false, error: message }), { status });
  };

  if (purpose === "order") {
    if (!orderId) return fail(400, "Missing orderId");

    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("id, amount, paid")
      .eq("id", orderId)
      .single();

    if (fetchErr || !order) return fail(404, "Order not found");

    const expectedKobo = Math.round(Number(order.amount) * 100);
    if (amountKobo !== expectedKobo) return fail(402, "Charged amount doesn't match order amount.");

    const { error: updateErr } = await supabase
      .from("orders")
      .update({ paid: true, paystack_reference: reference })
      .eq("id", orderId);
    if (updateErr) return fail(500, updateErr.message);

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  if (purpose === "verification") {
    if (!vendorId) return fail(400, "Missing vendorId");

    const expectedKobo = 1000 * 100;
    if (amountKobo !== expectedKobo) return fail(402, "Unexpected charge amount.");

    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const { error: subErr } = await supabase.from("vendor_subscriptions").upsert({
      vendor_id: vendorId,
      status: "active",
      current_period_end: periodEnd.toISOString(),
    });
    if (subErr) return fail(500, subErr.message);

    const { error: profErr } = await supabase
      .from("profiles")
      .update({ verified: true, verified_until: periodEnd.toISOString() })
      .eq("id", vendorId);
    if (profErr) return fail(500, profErr.message);

    return new Response(JSON.stringify({ ok: true, current_period_end: periodEnd.toISOString() }), {
      status: 200,
    });
  }

  if (purpose === "coins") {
    if (!buyerId || !coins) return fail(400, "Missing buyerId or coins");

    const COIN_PACKAGES = [
      { coins: 100, priceNgn: 1000 },
      { coins: 550, priceNgn: 5000 },
      { coins: 1200, priceNgn: 10000 },
    ];
    const pkg = COIN_PACKAGES.find((p) => p.coins === coins);
    if (!pkg || amountKobo !== pkg.priceNgn * 100) return fail(402, "Unrecognized coin package or amount.");

    const { error: coinErr } = await supabase.rpc("add_coins", { profile_id: buyerId, amount: coins });
    if (coinErr) return fail(500, coinErr.message);

    await supabase.from("coin_purchases").insert({
      buyer_id: buyerId,
      coins,
      amount_ngn: pkg.priceNgn,
      paystack_reference: reference,
    });

    const { data: prof } = await supabase.from("profiles").select("coin_balance").eq("id", buyerId).single();

    return new Response(JSON.stringify({ ok: true, newBalance: prof?.coin_balance }), { status: 200 });
  }

  return fail(400, "Unknown purpose");
}

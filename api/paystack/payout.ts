import { createClient } from "@supabase/supabase-js";
import { authenticateVendor } from "../_lib/authenticateVendor";

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const vendor = await authenticateVendor(req);
  if (!vendor) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secretKey || !supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Server not fully configured." }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: profile } = await supabase
    .from("profiles")
    .select("paystack_recipient_code, account_name")
    .eq("id", vendor.profileId)
    .single();

  if (!profile?.paystack_recipient_code) {
    return new Response(
      JSON.stringify({ ok: false, error: "Add your bank account before withdrawing." }),
      { status: 400 }
    );
  }

  const { data: balance, error: balErr } = await supabase.rpc("vendor_available_balance", {
    p_vendor_id: vendor.profileId,
  });
  if (balErr) return new Response(JSON.stringify({ ok: false, error: balErr.message }), { status: 500 });

  const amount = Number(balance);
  if (!amount || amount < 100) {
    return new Response(
      JSON.stringify({ ok: false, error: "Balance too low to withdraw (minimum ₦100)." }),
      { status: 400 }
    );
  }

  const { data: payoutRow, error: insertErr } = await supabase
    .from("payouts")
    .insert({ vendor_id: vendor.profileId, amount_ngn: amount, status: "pending" })
    .select()
    .single();
  if (insertErr || !payoutRow) {
    return new Response(JSON.stringify({ ok: false, error: insertErr?.message ?? "Couldn't start payout." }), {
      status: 500,
    });
  }

  const transferRes = await fetch("https://api.paystack.co/transfer", {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "balance",
      amount: Math.round(amount * 100),
      recipient: profile.paystack_recipient_code,
      reason: "GistVille gift earnings payout",
      reference: payoutRow.id,
    }),
  });
  const transferData = await transferRes.json();

  if (!transferRes.ok) {
    await supabase
      .from("payouts")
      .update({ status: "failed", failure_reason: transferData.message ?? "Transfer failed" })
      .eq("id", payoutRow.id);
    return new Response(
      JSON.stringify({ ok: false, error: transferData.message ?? "Transfer failed." }),
      { status: 502 }
    );
  }

  const transferStatus: string = transferData.data?.status ?? "pending";
  await supabase
    .from("payouts")
    .update({
      status: transferStatus === "success" ? "success" : "pending",
      paystack_transfer_code: transferData.data?.transfer_code ?? null,
      failure_reason: transferStatus === "otp" ? "Requires OTP finalization in Paystack dashboard" : null,
    })
    .eq("id", payoutRow.id);

  return new Response(
    JSON.stringify({ ok: true, status: transferStatus, amount }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

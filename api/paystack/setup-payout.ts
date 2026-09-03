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

  let body: { accountNumber?: string; bankCode?: string; bankName?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }
  const { accountNumber, bankCode, bankName } = body;
  if (!accountNumber || !bankCode) {
    return new Response(JSON.stringify({ error: "Missing account number or bank" }), { status: 400 });
  }

  const resolveRes = await fetch(
    `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
    { headers: { Authorization: `Bearer ${secretKey}` } }
  );
  const resolveData = await resolveRes.json();
  if (!resolveRes.ok || !resolveData.data?.account_name) {
    return new Response(
      JSON.stringify({ ok: false, error: "Couldn't verify that account — check the number and bank." }),
      { status: 402 }
    );
  }
  const accountName: string = resolveData.data.account_name;

  const recipientRes = await fetch("https://api.paystack.co/transferrecipient", {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "nuban",
      name: accountName,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: "NGN",
    }),
  });
  const recipientData = await recipientRes.json();
  if (!recipientRes.ok || !recipientData.data?.recipient_code) {
    return new Response(JSON.stringify({ ok: false, error: "Couldn't save this payout account." }), {
      status: 502,
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { error: updateErr } = await supabase
    .from("profiles")
    .update({
      bank_code: bankCode,
      bank_name: bankName ?? null,
      account_number: accountNumber,
      account_name: accountName,
      paystack_recipient_code: recipientData.data.recipient_code,
    })
    .eq("id", vendor.profileId);

  if (updateErr) return new Response(JSON.stringify({ ok: false, error: updateErr.message }), { status: 500 });

  return new Response(JSON.stringify({ ok: true, accountName }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

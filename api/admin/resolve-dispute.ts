import { createClient } from "@supabase/supabase-js";
import { authenticateAdmin } from "../_lib/authenticateAdmin";
import { sendNotification } from "../_lib/notifications";

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const admin = await authenticateAdmin(req);
  if (!admin) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Server not fully configured." }), { status: 500 });
  }

  let body: { disputeId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }
  if (!body.disputeId) {
    return new Response(JSON.stringify({ error: "Missing disputeId" }), { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: dispute, error } = await supabase
    .from("disputes")
    .update({ status: "resolved" })
    .eq("id", body.disputeId)
    .select("order_id, orders(description, buyer_id, profiles!orders_buyer_id_fkey(phone))")
    .single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  try {
    const order = (dispute as unknown as {
      orders?: { description?: string; profiles?: { phone?: string } };
    })?.orders;
    if (order?.profiles?.phone) {
      await sendNotification(
        order.profiles.phone,
        `GistVille: The dispute on your order "${order.description ?? "order"}" has been resolved.`
      );
    }
  } catch (err) {
    console.error("resolve-dispute notify failed:", err);
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}

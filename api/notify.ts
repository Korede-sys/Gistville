import { createClient } from "@supabase/supabase-js";
import { sendNotification } from "./_lib/notifications";

export const config = { runtime: "edge" };

type NotifyEvent =
  | { event: "order_created"; orderId: string }
  | { event: "order_status_changed"; orderId: string; status: string }
  | { event: "dispute_filed"; orderId: string };

// Fire-and-forget notifications for order/dispute lifecycle events. This
// endpoint intentionally never fails loudly — a notification problem
// should never block the order/dispute action that triggered it, so every
// path below returns 200 even when the underlying send didn't go out
// (check server logs / Twilio console for delivery issues, not the caller).
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ ok: false, skipped: "not configured" }), { status: 200 });
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let body: NotifyEvent;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }

  try {
    if (body.event === "order_created") {
      const { data: order } = await supabase
        .from("orders")
        .select("id, description, amount, buyer_name, vendor_id, profiles!orders_vendor_id_fkey(phone, business_name, name)")
        .eq("id", body.orderId)
        .single();
      const vendor = (order as unknown as { profiles?: { phone?: string } })?.profiles;
      if (order && vendor?.phone) {
        await sendNotification(
          vendor.phone,
          `GistVille: New order from ${order.buyer_name} — "${order.description}" (₦${Number(order.amount).toLocaleString()}). Open the app to respond.`
        );
      }
    }

    if (body.event === "order_status_changed") {
      const { data: order } = await supabase
        .from("orders")
        .select("id, description, buyer_id, profiles!orders_buyer_id_fkey(phone)")
        .eq("id", body.orderId)
        .single();
      const buyer = (order as unknown as { profiles?: { phone?: string } })?.profiles;
      if (order && buyer?.phone) {
        const statusCopy: Record<string, string> = {
          in_progress: "is now in progress",
          ready: "is ready",
          completed: "has been completed",
        };
        const phrase = statusCopy[body.status] ?? `was updated to ${body.status}`;
        await sendNotification(buyer.phone, `GistVille: Your order "${order.description}" ${phrase}.`);
      }
    }

    if (body.event === "dispute_filed") {
      const { data: order } = await supabase
        .from("orders")
        .select("id, description, vendor_id, profiles!orders_vendor_id_fkey(phone)")
        .eq("id", body.orderId)
        .single();
      const vendor = (order as unknown as { profiles?: { phone?: string } })?.profiles;
      if (order && vendor?.phone) {
        await sendNotification(
          vendor.phone,
          `GistVille: A dispute was filed on order "${order.description}". Check the app for details.`
        );
      }
    }
  } catch (err) {
    // Swallow — notifications are best-effort, never surface as a failed
    // order/dispute action to the end user.
    console.error("notify failed:", err);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

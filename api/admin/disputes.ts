import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  const accessCode = process.env.ADMIN_ACCESS_CODE;
  const supplied = req.headers.get("x-admin-code");
  if (!accessCode || supplied !== accessCode) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Server not fully configured." }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await supabase
    .from("disputes")
    .select("id, order_id, reason, status, created_at, orders(id, description, amount, buyer_name, vendor_id, profiles(business_name, name))")
    .order("created_at", { ascending: false });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ disputes: data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

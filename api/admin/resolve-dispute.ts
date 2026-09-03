import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

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
  const { error } = await supabase
    .from("disputes")
    .update({ status: "resolved" })
    .eq("id", body.disputeId);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}

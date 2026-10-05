import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "edge" };

/**
 * One-time promotion: a normal logged-in user (any Supabase account) submits
 * the shared ADMIN_ACCESS_CODE once to add themselves to admin_users. After
 * that they're a real per-admin login — the code is only the bootstrap
 * secret for granting the *first* admins, not an ongoing access control.
 * Rotate ADMIN_ACCESS_CODE once you've bootstrapped the admins you need.
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }

  const accessCode = process.env.ADMIN_ACCESS_CODE;
  if (!accessCode || !body.code || body.code !== accessCode) {
    return new Response(JSON.stringify({ error: "Invalid setup code" }), { status: 403 });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Server not fully configured." }), { status: 500 });
  }

  const authClient = createClient(supabaseUrl, anonKey);
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token);
  if (error || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { error: upsertError } = await adminClient
    .from("admin_users")
    .upsert({ auth_user_id: user.id }, { onConflict: "auth_user_id" });

  if (upsertError) {
    return new Response(JSON.stringify({ error: upsertError.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

import { createClient } from "@supabase/supabase-js";

export interface AuthedAdmin {
  authUserId: string;
  email: string | undefined;
}

/**
 * Real per-admin auth: verifies the caller's Supabase session token (a
 * normal logged-in user, same as any buyer/vendor), then checks the
 * `admin_users` table (service-role only, no client-side policies) for
 * that user's auth_user_id. Replaces the old shared ADMIN_ACCESS_CODE as
 * the ongoing gate — the access code now only bootstraps the first admin
 * (see api/admin/bootstrap-admin.ts).
 */
export async function authenticateAdmin(req: Request): Promise<AuthedAdmin | null> {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return null;

  const authClient = createClient(supabaseUrl, anonKey);
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token);
  if (error || !user) return null;

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: adminRow } = await adminClient
    .from("admin_users")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (!adminRow) return null;
  return { authUserId: user.id, email: user.email };
}

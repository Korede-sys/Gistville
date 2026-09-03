import { createClient } from "@supabase/supabase-js";

export interface AuthedVendor {
  authUserId: string;
  profileId: string;
}

export async function authenticateVendor(req: Request): Promise<AuthedVendor | null> {
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
  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .single();

  if (!profile || profile.role !== "vendor") return null;
  return { authUserId: user.id, profileId: profile.id };
}

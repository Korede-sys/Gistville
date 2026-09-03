import { ensureVerificationPlanCode } from "../_lib/paystackPlan";

export const config = { runtime: "edge" };

export default async function handler(): Promise<Response> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secretKey || !supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Server not fully configured." }), { status: 500 });
  }

  const result = await ensureVerificationPlanCode(supabaseUrl, serviceRoleKey, secretKey);
  if (!result.ok) return new Response(JSON.stringify({ error: result.error }), { status: 500 });

  return new Response(JSON.stringify({ planCode: result.planCode }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

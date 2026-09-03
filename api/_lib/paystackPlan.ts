import { createClient } from "@supabase/supabase-js";

const PLAN_SETTINGS_KEY = "paystack_verification_plan_code";
export const VERIFICATION_FEE_NGN = 1000;

export async function ensureVerificationPlanCode(
  supabaseUrl: string,
  serviceRoleKey: string,
  paystackSecretKey: string
): Promise<{ ok: boolean; planCode?: string; error?: string }> {
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: existing } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", PLAN_SETTINGS_KEY)
    .single();

  if (existing?.value) return { ok: true, planCode: existing.value };

  const res = await fetch("https://api.paystack.co/plan", {
    method: "POST",
    headers: { Authorization: `Bearer ${paystackSecretKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "GistVille Vendor Verification",
      interval: "monthly",
      amount: VERIFICATION_FEE_NGN * 100,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.data?.plan_code) {
    return { ok: false, error: data.message ?? "Couldn't create the Paystack plan." };
  }

  await supabase.from("app_settings").upsert({ key: PLAN_SETTINGS_KEY, value: data.data.plan_code });
  return { ok: true, planCode: data.data.plan_code };
}

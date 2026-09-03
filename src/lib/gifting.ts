import { supabase, isSupabaseConfigured } from "./supabase";
import { payWithPaystack } from "./paystack";
import type { Gift, GiftTransaction, CoinPackage } from "../types";

export const COIN_PACKAGES: CoinPackage[] = [
  { coins: 100, priceNgn: 1000 },
  { coins: 550, priceNgn: 5000, bonus: true },
  { coins: 1200, priceNgn: 10000, bonus: true },
];

const MOCK_GIFTS: Gift[] = [
  { id: "rose", name: "Rose", emoji: "🌹", coin_cost: 10, sort_order: 1 },
  { id: "heart", name: "Heart", emoji: "❤️", coin_cost: 20, sort_order: 2 },
  { id: "bouquet", name: "Bouquet", emoji: "💐", coin_cost: 50, sort_order: 3 },
  { id: "diamond", name: "Diamond", emoji: "💎", coin_cost: 200, sort_order: 4 },
  { id: "crown", name: "Crown", emoji: "👑", coin_cost: 500, sort_order: 5 },
];

export async function fetchGiftCatalog(): Promise<Gift[]> {
  if (!isSupabaseConfigured || !supabase) return MOCK_GIFTS;
  const { data, error } = await supabase
    .from("gift_catalog")
    .select("*")
    .eq("active", true)
    .order("sort_order");
  if (error || !data) return MOCK_GIFTS;
  return data as Gift[];
}

export async function sendGift(
  senderId: string,
  recipientId: string,
  giftId: string
): Promise<{ ok: boolean; error?: string; vendorEarningNgn?: number }> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: true, vendorEarningNgn: 0 };
  }

  const { data, error } = await supabase.rpc("send_gift", {
    p_sender_id: senderId,
    p_recipient_id: recipientId,
    p_gift_id: giftId,
  });
  if (error) return { ok: false, error: error.message };
  const result = data as { ok: boolean; error?: string; vendor_earning_ngn?: number };
  if (!result.ok) return { ok: false, error: result.error ?? "Couldn't send gift." };
  return { ok: true, vendorEarningNgn: result.vendor_earning_ngn };
}

export async function buyCoinPackage(
  buyerId: string,
  email: string,
  pkg: CoinPackage
): Promise<{ ok: boolean; error?: string; newBalance?: number }> {
  const payRes = await payWithPaystack({
    email,
    amountKobo: pkg.priceNgn * 100,
    metadata: { buyerId, coins: pkg.coins, purpose: "coins" },
  });
  if (!payRes.ok || !payRes.reference) {
    return { ok: false, error: payRes.error ?? "Payment was not completed." };
  }

  try {
    const res = await fetch("/api/paystack/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reference: payRes.reference,
        purpose: "coins",
        buyerId,
        coins: pkg.coins,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) return { ok: false, error: data.error ?? "Verification failed." };
    return { ok: true, newBalance: data.newBalance };
  } catch {
    return { ok: false, error: "Couldn't reach the verification server." };
  }
}

export async function fetchVendorGiftTransactions(vendorId: string): Promise<GiftTransaction[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from("gift_transactions")
    .select("*, gift_catalog(*)")
    .eq("recipient_id", vendorId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as unknown as GiftTransaction[];
}

export function vendorGiftEarningsTotal(transactions: GiftTransaction[]): number {
  return transactions.reduce((sum, t) => sum + Number(t.vendor_earning_ngn), 0);
}

// ---------------------------------------------------------------------------
// Payouts
// ---------------------------------------------------------------------------

async function authedFetch(path: string, body?: unknown) {
  if (!supabase) return { ok: false, error: "Not connected." };
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "You're not logged in." };

  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: data.error ?? "Request failed." };
  return data;
}

export interface Bank {
  name: string;
  code: string;
}

export async function fetchBanks(): Promise<Bank[]> {
  try {
    const res = await fetch("/api/paystack/banks");
    const data = await res.json();
    return res.ok ? data.banks : [];
  } catch {
    return [];
  }
}

export async function setupPayoutAccount(input: {
  accountNumber: string;
  bankCode: string;
  bankName: string;
}): Promise<{ ok: boolean; error?: string; accountName?: string }> {
  return authedFetch("/api/paystack/setup-payout", input);
}

export async function fetchAvailableBalance(vendorId: string): Promise<number> {
  if (!isSupabaseConfigured || !supabase) return 0;
  const { data, error } = await supabase.rpc("vendor_available_balance", { p_vendor_id: vendorId });
  if (error) return 0;
  return Number(data) || 0;
}

export async function requestPayout(): Promise<{ ok: boolean; error?: string; status?: string; amount?: number }> {
  return authedFetch("/api/paystack/payout");
}

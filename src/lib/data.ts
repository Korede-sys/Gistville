import { supabase, isSupabaseConfigured } from "./supabase";
import { isEffectivelyVerified } from "./verification";
import type {
  Vendor,
  VendorRequest,
  OrderStatus,
  Listing,
  AdCampaign,
  Order,
  VendorSubscription,
  Message,
} from "../types";

// ---------------------------------------------------------------------------
// Mock data. Used whenever Supabase env vars aren't set, so the app is fully
// browsable before the database exists.
// ---------------------------------------------------------------------------

export const MOCK_VENDORS: Vendor[] = [
  {
    id: "1",
    name: "Amaka's Stitch House",
    category: "Tailoring",
    area: "Wuse 2",
    rating: 4.8,
    reviews: 62,
    verified: true,
    price_from: "₦8,000+",
    gradient: "linear-gradient(135deg, #2B4C7E, #1E3760)",
    availability_status: "busy",
    availability_detail: "Booked until Aug 20",
    previously_ordered: true,
    payment_provider: "paystack",
    menu: [
      { item: "Ankara gown (simple)", price: "₦8,000" },
      { item: "Aso-ebi gown + gele combo", price: "₦18,000" },
      { item: "Native wear (men)", price: "₦12,000" },
    ],
  },
  {
    id: "2",
    name: "Glow by Tolu",
    category: "Makeup artist",
    area: "Garki",
    rating: 4.9,
    reviews: 104,
    verified: true,
    price_from: "₦15,000+",
    gradient: "linear-gradient(135deg, #D4A017, #96760F)",
    availability_status: "open",
    availability_detail: "Available this week",
    payment_provider: "paystack",
    menu: [
      { item: "Bridal makeup", price: "₦35,000" },
      { item: "Party makeup", price: "₦15,000" },
      { item: "Makeup + gele styling", price: "₦22,000" },
    ],
  },
  {
    id: "3",
    name: "Gele Queen NG",
    category: "Aso-ebi & Gele",
    area: "Lugbe",
    rating: 4.6,
    reviews: 31,
    verified: false,
    price_from: "₦5,000+",
    gradient: "linear-gradient(135deg, #1F7A4D, #14532d)",
    availability_status: "open",
    availability_detail: "Available this week",
    payment_provider: "paystack",
    menu: [
      { item: "Gele tying (single)", price: "₦5,000" },
      { item: "Gele + head-tie set", price: "₦9,000" },
    ],
  },
];

export const MOCK_REQUESTS: VendorRequest[] = [
  {
    id: "1",
    text: "Who does gele for owambe this Saturday, Wuse area? Need someone available same-day.",
    poster_name: "Chiamaka",
    area: "Wuse",
    created_at: new Date(Date.now() - 12 * 60_000).toISOString(),
    response_count: 3,
  },
  {
    id: "2",
    text: "Looking for a tailor who can rush a native wear before Friday. Garki or nearby.",
    poster_name: "Emeka",
    area: "Garki",
    created_at: new Date(Date.now() - 60 * 60_000).toISOString(),
    response_count: 1,
  },
  {
    id: "3",
    text: "Recommend a makeup artist for a small traditional wedding, budget ₦20k.",
    poster_name: "Blessing",
    area: "Lugbe",
    created_at: new Date(Date.now() - 3 * 60 * 60_000).toISOString(),
    response_count: 5,
  },
];

// ---------------------------------------------------------------------------
// Vendor directory — reads from `profiles` (role='vendor') joined with
// vendor_menu_items. NOTE: this used to query a separate `vendors` table
// that was dropped in the vendor-identity-merge migration — keep this
// pointed at `profiles`, not `vendors` (that table doesn't exist anymore).
// ---------------------------------------------------------------------------

function profileRowToVendor(row: Record<string, unknown>): Vendor {
  const menuItems = (row.vendor_menu_items as Array<{ item: string; price: string }> | null) ?? [];
  return {
    id: row.id as string,
    name: (row.business_name as string) || (row.name as string),
    category: row.category as string,
    area: row.area as string,
    rating: Number(row.rating ?? 5),
    reviews: Number(row.reviews ?? 0),
    verified: isEffectivelyVerified(row.verified as boolean, row.verified_until as string | null),
    price_from: (row.price_from as string) ?? "",
    gradient: (row.gradient as string) ?? "linear-gradient(135deg, #2B4C7E, #1E3760)",
    availability_status: (row.availability_status as "open" | "busy") ?? "open",
    availability_detail: (row.availability_detail as string) ?? "",
    menu: menuItems.map((m) => ({ item: m.item, price: m.price })),
    payment_provider: (row.payment_provider as "paystack" | "stripe" | undefined) ?? "paystack",
    country: row.country as string | undefined,
  };
}

export async function fetchVendors(): Promise<Vendor[]> {
  if (!isSupabaseConfigured || !supabase) return MOCK_VENDORS;

  const { data, error } = await supabase
    .from("profiles")
    .select("*, vendor_menu_items(*)")
    .eq("role", "vendor")
    .order("rating", { ascending: false });

  if (error || !data) {
    console.error("fetchVendors failed, falling back to mock data:", error);
    return MOCK_VENDORS;
  }
  return data.map(profileRowToVendor);
}

export async function fetchVendorById(id: string): Promise<Vendor | null> {
  if (!isSupabaseConfigured || !supabase) {
    return MOCK_VENDORS.find((v) => v.id === id) ?? null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*, vendor_menu_items(*)")
    .eq("id", id)
    .eq("role", "vendor")
    .single();

  if (error || !data) return MOCK_VENDORS.find((v) => v.id === id) ?? null;
  return profileRowToVendor(data);
}

export async function fetchRequests(): Promise<VendorRequest[]> {
  if (!isSupabaseConfigured || !supabase) return MOCK_REQUESTS;

  const { data, error } = await supabase
    .from("vendor_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("fetchRequests failed, falling back to mock data:", error);
    return MOCK_REQUESTS;
  }
  return data as VendorRequest[];
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export interface WaitlistEntry {
  name: string;
  phone: string;
  role: "vendor" | "buyer";
  category?: string;
  area: string;
}

export async function submitWaitlistEntry(
  entry: WaitlistEntry
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    console.info("[waitlist:local-only]", entry);
    return { ok: true };
  }

  const { error } = await supabase.from("waitlist").insert({
    name: entry.name,
    phone: entry.phone,
    role: entry.role,
    category: entry.category ?? null,
    area: entry.area,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function createVendorRequest(
  text: string,
  area: string,
  posterName = "You"
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    MOCK_REQUESTS.unshift({
      id: crypto.randomUUID(),
      text,
      poster_name: posterName,
      area,
      created_at: new Date().toISOString(),
      response_count: 0,
    });
    return { ok: true };
  }

  const { error } = await supabase
    .from("vendor_requests")
    .insert({ text, area, poster_name: posterName });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Fire-and-forget: notifications are best-effort and must never block or
// fail the order/dispute action that triggered them.
function notifyEvent(payload: Record<string, unknown>): void {
  fetch("/api/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {
    /* best-effort — ignore */
  });
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    console.info("[order-status:local-only]", orderId, status);
    return { ok: true };
  }

  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId);

  if (error) return { ok: false, error: error.message };
  notifyEvent({ event: "order_status_changed", orderId, status });
  return { ok: true };
}

export async function fileDispute(
  orderId: string,
  reason: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    console.info("[dispute:local-only]", orderId, reason);
    return { ok: true };
  }

  const { error } = await supabase
    .from("disputes")
    .insert({ order_id: orderId, reason, status: "open" });

  if (error) return { ok: false, error: error.message };
  notifyEvent({ event: "dispute_filed", orderId });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Listings (feed content)
// ---------------------------------------------------------------------------
const MOCK_LISTINGS: Listing[] = [];

export async function fetchVendorListings(vendorId: string): Promise<Listing[]> {
  if (!isSupabaseConfigured || !supabase) {
    return MOCK_LISTINGS.filter((l) => l.vendor_id === vendorId);
  }
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as Listing[];
}

export async function fetchFeedListings(): Promise<Listing[]> {
  if (!isSupabaseConfigured || !supabase) return MOCK_LISTINGS;
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return MOCK_LISTINGS;
  return data as Listing[];
}

export async function createListing(
  input: Omit<Listing, "id" | "created_at">
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    MOCK_LISTINGS.unshift({
      ...input,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    });
    return { ok: true };
  }
  const { error } = await supabase.from("listings").insert(input);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Ads
// ---------------------------------------------------------------------------
const MOCK_ADS: AdCampaign[] = [];

export const AD_PLATFORM_FEE_RATE = 0.2;

export async function fetchVendorAds(vendorId: string): Promise<AdCampaign[]> {
  if (!isSupabaseConfigured || !supabase) {
    return MOCK_ADS.filter((a) => a.vendor_id === vendorId);
  }
  const { data, error } = await supabase
    .from("ad_campaigns")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as AdCampaign[];
}

export async function createAdCampaign(
  vendorId: string,
  listingId: string,
  budget: number
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    MOCK_ADS.unshift({
      id: crypto.randomUUID(),
      vendor_id: vendorId,
      listing_id: listingId,
      budget,
      spent: 0,
      impressions: 0,
      clicks: 0,
      status: "active",
      created_at: new Date().toISOString(),
    });
    return { ok: true };
  }
  const { error } = await supabase
    .from("ad_campaigns")
    .insert({ vendor_id: vendorId, listing_id: listingId, budget, status: "active" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export interface BoostedListing extends Listing {
  ad_campaign_id: string;
}

const IMPRESSION_COST_NGN = 5;

export async function fetchBoostedListings(): Promise<BoostedListing[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from("ad_campaigns")
    .select("id, listing_id, spent, budget, listings(*)")
    .eq("status", "active");

  if (error || !data) return [];

  return (data as unknown as Array<{ id: string; spent: number; budget: number; listings: Listing | null }>)
    .filter((row) => row.listings && row.spent < row.budget)
    .map((row) => ({ ...(row.listings as Listing), ad_campaign_id: row.id }));
}

export async function recordAdImpression(campaignId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.rpc("increment_ad_impression", {
    campaign_id: campaignId,
    cost: IMPRESSION_COST_NGN,
  });
}

export async function recordAdClick(campaignId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.rpc("increment_ad_click", { campaign_id: campaignId });
}

// ---------------------------------------------------------------------------
// Verification subscription
// ---------------------------------------------------------------------------
const MOCK_SUBSCRIPTIONS: Record<string, VendorSubscription> = {};

export async function fetchSubscription(vendorId: string): Promise<VendorSubscription | null> {
  if (!isSupabaseConfigured || !supabase) {
    return MOCK_SUBSCRIPTIONS[vendorId] ?? null;
  }
  const { data, error } = await supabase
    .from("vendor_subscriptions")
    .select("*")
    .eq("vendor_id", vendorId)
    .single();
  if (error || !data) return null;
  return data as VendorSubscription;
}

// NOTE: subscriptions are now activated via the real Paystack flow — see
// payWithPaystack() + verifyPaystackPayment() in
// src/pages/vendor/VendorVerification.tsx and api/paystack/verify.ts /
// api/paystack/webhook.ts, which are the only things that write to
// vendor_subscriptions for a real charge.

// ---------------------------------------------------------------------------
// Orders — vendor and buyer views
// ---------------------------------------------------------------------------
const MOCK_ORDERS: Order[] = [];

export async function createOrder(input: {
  vendorId: string;
  buyerId: string;
  buyerName: string;
  buyerPhone?: string;
  description: string;
  amount: number;
  currency?: string;
}): Promise<{ ok: boolean; order?: Order; error?: string }> {
  const order: Order = {
    id: crypto.randomUUID(),
    vendor_id: input.vendorId,
    buyer_id: input.buyerId,
    buyer_name: input.buyerName,
    description: input.description,
    amount: input.amount,
    status: "pending",
    paid: false,
    created_at: new Date().toISOString(),
  };

  if (!isSupabaseConfigured || !supabase) {
    MOCK_ORDERS.unshift(order);
    return { ok: true, order };
  }

  const { data, error } = await supabase
    .from("orders")
    .insert({
      vendor_id: input.vendorId,
      buyer_id: input.buyerId,
      buyer_name: input.buyerName,
      buyer_phone: input.buyerPhone ?? null,
      description: input.description,
      amount: input.amount,
      currency: input.currency ?? "NGN",
    })
    .select()
    .single();

  if (error || !data) return { ok: false, error: error?.message };
  notifyEvent({ event: "order_created", orderId: (data as Order).id });
  return { ok: true, order: data as Order };
}

/**
 * Chat needs an order to attach messages to (the `messages` table is
 * order-scoped), but a buyer should be able to message a vendor before
 * paying — "chat, agree, pay", not "pay, then chat". This reuses the most
 * recent non-completed order between this buyer and vendor if one already
 * exists, or creates a fresh unpaid one, WITHOUT firing the "new order"
 * notification createOrder() does — opening a chat isn't a commitment yet,
 * only a real order being created/paid for is.
 */
export async function ensureConversationOrder(input: {
  vendorId: string;
  buyerId: string;
  buyerName: string;
  buyerPhone?: string;
  description: string;
  amount: number;
  currency?: string;
}): Promise<{ ok: boolean; order?: Order; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    const existingMock = MOCK_ORDERS.find(
      (o) => o.buyer_id === input.buyerId && o.vendor_id === input.vendorId && o.status !== "completed"
    );
    if (existingMock) return { ok: true, order: existingMock };
    const order: Order = {
      id: crypto.randomUUID(),
      vendor_id: input.vendorId,
      buyer_id: input.buyerId,
      buyer_name: input.buyerName,
      description: input.description,
      amount: input.amount,
      status: "pending",
      paid: false,
      created_at: new Date().toISOString(),
    };
    MOCK_ORDERS.unshift(order);
    return { ok: true, order };
  }

  const { data: existing } = await supabase
    .from("orders")
    .select("*")
    .eq("buyer_id", input.buyerId)
    .eq("vendor_id", input.vendorId)
    .neq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return { ok: true, order: existing as Order };

  const { data, error } = await supabase
    .from("orders")
    .insert({
      vendor_id: input.vendorId,
      buyer_id: input.buyerId,
      buyer_name: input.buyerName,
      buyer_phone: input.buyerPhone ?? null,
      description: input.description,
      amount: input.amount,
      currency: input.currency ?? "NGN",
    })
    .select()
    .single();

  if (error || !data) return { ok: false, error: error?.message };
  return { ok: true, order: data as Order };
}

export async function fetchOrderById(orderId: string): Promise<Order | null> {
  if (!isSupabaseConfigured || !supabase) {
    return MOCK_ORDERS.find((o) => o.id === orderId) ?? null;
  }
  const { data, error } = await supabase.from("orders").select("*").eq("id", orderId).single();
  if (error || !data) return null;
  return data as Order;
}

export async function fetchVendorOrders(vendorId: string): Promise<Order[]> {
  if (!isSupabaseConfigured || !supabase) {
    return MOCK_ORDERS.filter((o) => o.vendor_id === vendorId);
  }
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as Order[];
}

export async function fetchBuyerOrders(buyerId: string): Promise<Order[]> {
  if (!isSupabaseConfigured || !supabase) {
    return MOCK_ORDERS.filter((o) => o.buyer_id === buyerId);
  }
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as Order[];
}

// ---------------------------------------------------------------------------
// Chat messages (per-order threads, real-time via Supabase Realtime)
// ---------------------------------------------------------------------------
const MOCK_MESSAGES: Message[] = [];

export async function fetchMessages(orderId: string): Promise<Message[]> {
  if (!isSupabaseConfigured || !supabase) {
    return MOCK_MESSAGES.filter((m) => m.order_id === orderId);
  }
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data as Message[];
}

export async function sendMessage(
  orderId: string,
  sender: "buyer" | "vendor",
  text: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    MOCK_MESSAGES.push({
      id: crypto.randomUUID(),
      order_id: orderId,
      sender,
      text,
      created_at: new Date().toISOString(),
    });
    return { ok: true };
  }
  const { error } = await supabase.from("messages").insert({ order_id: orderId, sender, text });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Subscribes to new messages on one order's thread in real time. Returns
 * an unsubscribe function — always call it on unmount/order change, since
 * each call opens its own Supabase Realtime channel.
 */
export function subscribeToMessages(orderId: string, onInsert: (message: Message) => void): () => void {
  if (!isSupabaseConfigured || !supabase) return () => {};
  const client = supabase;
  const channel = client
    .channel(`messages:${orderId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `order_id=eq.${orderId}` },
      (payload) => onInsert(payload.new as Message)
    )
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}

// ---------------------------------------------------------------------------
// Saved vendors (buyer bookmarks)
// ---------------------------------------------------------------------------
const MOCK_SAVED: Set<string> = new Set();

export async function fetchSavedVendors(buyerId: string): Promise<Vendor[]> {
  if (!isSupabaseConfigured || !supabase) {
    return MOCK_VENDORS.filter((v) => MOCK_SAVED.has(v.id));
  }
  const { data, error } = await supabase
    .from("saved_vendors")
    .select("vendor_id, profiles!saved_vendors_vendor_id_fkey(*, vendor_menu_items(*))")
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as unknown as Array<{ profiles: Record<string, unknown> | null }>)
    .filter((row) => row.profiles)
    .map((row) => profileRowToVendor(row.profiles as Record<string, unknown>));
}

export async function isVendorSaved(buyerId: string, vendorId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return MOCK_SAVED.has(vendorId);
  const { data } = await supabase
    .from("saved_vendors")
    .select("id")
    .eq("buyer_id", buyerId)
    .eq("vendor_id", vendorId)
    .maybeSingle();
  return Boolean(data);
}

export async function saveVendor(
  buyerId: string,
  vendorId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    MOCK_SAVED.add(vendorId);
    return { ok: true };
  }
  const { error } = await supabase
    .from("saved_vendors")
    .upsert({ buyer_id: buyerId, vendor_id: vendorId }, { onConflict: "buyer_id,vendor_id" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function unsaveVendor(
  buyerId: string,
  vendorId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    MOCK_SAVED.delete(vendorId);
    return { ok: true };
  }
  const { error } = await supabase
    .from("saved_vendors")
    .delete()
    .eq("buyer_id", buyerId)
    .eq("vendor_id", vendorId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Paystack payment verification (server-side, see api/paystack/verify.ts)
// ---------------------------------------------------------------------------
export async function verifyPaystackPayment(input: {
  reference: string;
  purpose: "order" | "verification" | "coins";
  orderId?: string;
  vendorId?: string;
  buyerId?: string;
  coins?: number;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/paystack/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) return { ok: false, error: data.error ?? "Verification failed." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't reach the verification server." };
  }
}

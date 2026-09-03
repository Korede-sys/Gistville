export type AvailabilityStatus = "open" | "busy";

export interface MenuItem {
  item: string;
  price: string;
}

export interface Vendor {
  id: string;
  name: string;
  category: string;
  area: string;
  rating: number;
  reviews: number;
  verified: boolean;
  price_from: string;
  gradient: string;
  availability_status: AvailabilityStatus;
  availability_detail: string;
  menu: MenuItem[];
  previously_ordered?: boolean;
  payment_provider?: "paystack" | "stripe";
  country?: string;
}

export interface Message {
  id: string;
  order_id: string;
  from: "buyer" | "vendor";
  text: string;
  created_at: string;
}

export const ORDER_STEPS = [
  "pending",
  "in_progress",
  "ready",
  "completed",
] as const;
export type OrderStatus = (typeof ORDER_STEPS)[number];

export interface Order {
  id: string;
  vendor_id: string;
  buyer_id?: string;
  buyer_name: string;
  description: string;
  amount: number;
  currency?: string;
  status: OrderStatus;
  paid: boolean;
  created_at: string;
}

export interface VendorRequest {
  id: string;
  text: string;
  poster_name: string;
  area: string;
  created_at: string;
  response_count: number;
}

export interface Dispute {
  id: string;
  order_id: string;
  reason: string;
  status: "open" | "resolved";
  created_at: string;
}

export type Role = "vendor" | "buyer";

export interface Profile {
  id: string;
  role: Role;
  name: string;
  email?: string;
  phone?: string;
  business_name?: string;
  category?: string;
  area?: string;
  verified: boolean;
  verified_until?: string | null;
  coin_balance: number;
  bank_name?: string | null;
  account_number?: string | null;
  account_name?: string | null;
  paystack_recipient_code?: string | null;
  country?: string;
  payment_provider?: "paystack" | "stripe";
  stripe_account_id?: string | null;
  created_at: string;
}

export type MediaType = "photo" | "video";

export interface Listing {
  id: string;
  vendor_id: string;
  media_type: MediaType;
  media_url: string;
  caption: string;
  price: string;
  created_at: string;
}

export type AdStatus = "active" | "paused" | "completed";

export interface AdCampaign {
  id: string;
  vendor_id: string;
  listing_id: string;
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  status: AdStatus;
  created_at: string;
}

export interface VendorSubscription {
  id: string;
  vendor_id: string;
  status: "active" | "inactive" | "past_due";
  current_period_end: string | null;
}

export interface Gift {
  id: string;
  name: string;
  emoji: string;
  coin_cost: number;
  sort_order: number;
}

export interface GiftTransaction {
  id: string;
  sender_id: string;
  recipient_id: string;
  gift_id: string;
  coin_cost: number;
  vendor_earning_ngn: number;
  platform_fee_ngn: number;
  created_at: string;
  gift_catalog?: Gift;
}

export interface CoinPackage {
  coins: number;
  priceNgn: number;
  bonus?: boolean;
}

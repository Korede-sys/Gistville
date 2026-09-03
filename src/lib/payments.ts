const PAYSTACK_COUNTRIES = new Set(["NG", "GH", "ZA", "KE", "CI"]);

export type PaymentProvider = "paystack" | "stripe";

export function providerForCountry(countryCode: string): PaymentProvider {
  return PAYSTACK_COUNTRIES.has(countryCode.toUpperCase()) ? "paystack" : "stripe";
}

// Local currency per country for Stripe-routed vendors. Stripe supports any
// of these natively — Checkout already takes `currency` per-session (see
// api/stripe/checkout.ts, which reads it from the order rather than
// assuming USD) — so this was a mapping gap, not an integration gap.
// Not exhaustive — falls back to USD for anywhere not listed, a reasonable
// default rather than a broken one.
const COUNTRY_CURRENCY: Record<string, string> = {
  US: "USD",
  GB: "GBP",
  CA: "CAD",
  AU: "AUD",
  DE: "EUR",
  FR: "EUR",
  IN: "INR",
  NG: "NGN",
  GH: "GHS",
  ZA: "ZAR",
  KE: "KES",
  CI: "XOF",
};

export function currencyForCountry(countryCode?: string): string {
  if (!countryCode) return "USD";
  return COUNTRY_CURRENCY[countryCode.toUpperCase()] ?? "USD";
}

export const COUNTRIES = [
  { code: "NG", name: "Nigeria" },
  { code: "GH", name: "Ghana" },
  { code: "ZA", name: "South Africa" },
  { code: "KE", name: "Kenya" },
  { code: "CI", name: "Côte d'Ivoire" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "IN", name: "India" },
  { code: "OTHER", name: "Other" },
];

export function formatMoney(amount: number, currency: string): string {
  const symbols: Record<string, string> = {
    NGN: "₦",
    USD: "$",
    GBP: "£",
    EUR: "€",
    CAD: "CA$",
    AUD: "A$",
    INR: "₹",
    GHS: "₵",
    ZAR: "R",
    KES: "KSh",
    XOF: "CFA",
  };
  const symbol = symbols[currency] ?? `${currency} `;
  return `${symbol}${amount.toLocaleString()}`;
}

export const VERIFICATION_FEE = { NGN: 1000, USD: 2 };

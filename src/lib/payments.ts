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
  IN: "INR",
  NG: "NGN",
  GH: "GHS",
  ZA: "ZAR",
  KE: "KES",
  CI: "XOF",
  // Eurozone
  DE: "EUR",
  FR: "EUR",
  ES: "EUR",
  IT: "EUR",
  NL: "EUR",
  BE: "EUR",
  PT: "EUR",
  IE: "EUR",
  AT: "EUR",
  FI: "EUR",
  GR: "EUR",
  // Europe, non-euro
  PL: "PLN",
  SE: "SEK",
  DK: "DKK",
  CH: "CHF",
  NO: "NOK",
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
  { code: "IN", name: "India" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "PT", name: "Portugal" },
  { code: "IE", name: "Ireland" },
  { code: "AT", name: "Austria" },
  { code: "FI", name: "Finland" },
  { code: "GR", name: "Greece" },
  { code: "PL", name: "Poland" },
  { code: "SE", name: "Sweden" },
  { code: "DK", name: "Denmark" },
  { code: "CH", name: "Switzerland" },
  { code: "NO", name: "Norway" },
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
    PLN: "zł",
    SEK: "kr",
    DKK: "kr",
    CHF: "CHF ",
    NOK: "kr",
  };
  const symbol = symbols[currency] ?? `${currency} `;
  return `${symbol}${amount.toLocaleString()}`;
}

export const VERIFICATION_FEE = { NGN: 1000, USD: 2 };

// Monthly vendor-verification subscription price for Stripe-routed vendors,
// keyed by currency so the badge isn't USD/NGN-only. Roughly pegged to the
// same ~$2/month as the Paystack side, rounded to a sensible local amount.
// api/stripe/verification-checkout.ts keeps its own copy of this (server
// code can't import from src/ in this project's Vercel setup) and is the
// one that actually decides the charged amount — this export is for display
// only, so keep the two in sync if either changes.
export const VERIFICATION_FEE_STRIPE: Record<string, number> = {
  USD: 2,
  GBP: 2,
  EUR: 2,
  CAD: 3,
  AUD: 3,
  INR: 150,
  PLN: 8,
  SEK: 20,
  DKK: 14,
  CHF: 2,
  NOK: 20,
};

export function verificationFeeForCurrency(currency: string): number {
  return VERIFICATION_FEE_STRIPE[currency.toUpperCase()] ?? VERIFICATION_FEE_STRIPE.USD;
}

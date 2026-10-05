import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { fetchSubscription, verifyPaystackPayment } from "../../lib/data";
import { payWithPaystack } from "../../lib/paystack";
import type { VendorSubscription } from "../../types";

const VERIFICATION_FEE_NGN = 1000;

export default function VendorVerification() {
  const { profile } = useAuth();
  const [sub, setSub] = useState<VendorSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    fetchSubscription(profile.id)
      .then(setSub)
      .finally(() => setLoading(false));
  }, [profile]);

  const isStripeVendor = profile?.payment_provider === "stripe";

  const subscribe = async () => {
    if (!profile) return;
    if (!profile.email) {
      setError("Your account is missing an email — please contact support before subscribing.");
      return;
    }
    setActivating(true);
    setError(null);

    let planCode: string | undefined;
    try {
      const planRes = await fetch("/api/paystack/get-plan-code");
      const planData = await planRes.json();
      if (!planRes.ok) throw new Error(planData.error ?? "Couldn't set up billing plan.");
      planCode = planData.planCode;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't set up billing plan.");
      setActivating(false);
      return;
    }

    const payRes = await payWithPaystack({
      email: profile.email,
      amountKobo: VERIFICATION_FEE_NGN * 100,
      plan: planCode,
      metadata: { vendorId: profile.id, purpose: "verification" },
    });
    if (!payRes.ok || !payRes.reference) {
      setError(payRes.error ?? "Payment was not completed.");
      setActivating(false);
      return;
    }

    const verifyRes = await verifyPaystackPayment({
      reference: payRes.reference,
      purpose: "verification",
      vendorId: profile.id,
    });
    setActivating(false);
    if (!verifyRes.ok) {
      setError(verifyRes.error ?? "Payment could not be verified. If you were charged, contact support.");
      return;
    }

    const updated = await fetchSubscription(profile.id);
    setSub(updated);
  };

  const isActive = sub?.status === "active";
  const isPastDue = sub?.status === "past_due";

  if (isStripeVendor) {
    return (
      <div className="max-w-lg">
        <h1 className="text-2xl font-display font-semibold text-ink mb-1">Verification</h1>
        <div className="bg-white border border-stone-light rounded-sm p-6 mt-4">
          <p className="text-sm text-ink font-semibold mb-1.5">Not available on Stripe yet</p>
          <p className="text-xs text-ink/60">
            The verification badge currently only works for Paystack-routed vendors (Naira billing).
            Stripe-side verification isn't built yet — see README.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-display font-semibold text-ink mb-1">Verification</h1>
      <p className="text-sm text-stone mb-6">
        Verified vendors get a badge, priority placement in search, and buyer trust that converts
        to sales.
      </p>

      {loading ? (
        <p className="text-sm text-stone">Loading...</p>
      ) : isActive ? (
        <div className="bg-green/10 border border-green/20 rounded-sm p-5 flex items-start gap-3">
          <ShieldCheck size={22} className="text-green shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-ink">You're verified</p>
            <p className="text-xs text-ink/60 mt-1">
              Active until{" "}
              {sub?.current_period_end
                ? new Date(sub.current_period_end).toLocaleDateString()
                : "—"}
              . Renews automatically at ₦1,000/month — no action needed.
            </p>
          </div>
        </div>
      ) : isPastDue ? (
        <div className="bg-mustard/10 border border-mustard/20 rounded-sm p-5">
          <p className="text-sm font-semibold text-ink">Payment failed</p>
          <p className="text-xs text-ink/60 mt-1">
            Your last renewal charge didn't go through. Paystack will retry automatically — update
            your card on file if it keeps failing.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-stone-light rounded-sm p-6">
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-3xl font-display font-semibold text-ink">
              ₦{VERIFICATION_FEE_NGN.toLocaleString()}
            </span>
            <span className="text-sm text-stone">/month</span>
          </div>
          <ul className="text-sm text-ink/60 space-y-1.5 mt-4 mb-6">
            <li>✓ Verified badge on your profile and listings</li>
            <li>✓ Priority placement in your category</li>
            <li>✓ Higher buyer trust and conversion</li>
          </ul>
          <button
            onClick={subscribe}
            disabled={activating}
            className="w-full bg-indigo disabled:opacity-60 text-white text-sm font-semibold py-3 rounded-sm"
          >
            {activating ? "Processing..." : "Subscribe with Paystack"}
          </button>
          {error && <p className="text-xs text-red-600 mt-2.5 text-center">{error}</p>}
          <p className="text-[11px] text-stone mt-2.5 text-center">
            Renews automatically each month via Paystack — cancel any time from your bank/card
            settings or contact support.
          </p>
        </div>
      )}
    </div>
  );
}

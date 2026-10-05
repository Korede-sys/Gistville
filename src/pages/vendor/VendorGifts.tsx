import { useEffect, useState } from "react";
import { Gift as GiftIcon, Landmark, CheckCircle2, ExternalLink } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { fetchVendorOrders } from "../../lib/data";
import {
  fetchVendorGiftTransactions,
  vendorGiftEarningsTotal,
  fetchAvailableBalance,
  fetchBanks,
  setupPayoutAccount,
  requestPayout,
} from "../../lib/gifting";
import { startStripeOnboarding } from "../../lib/stripe";
import type { GiftTransaction } from "../../types";
import type { Bank } from "../../lib/gifting";

function PayoutSetup({ onSaved }: { onSaved: (accountName: string) => void }) {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBanks().then(setBanks);
  }, []);

  const submit = async () => {
    const bank = banks.find((b) => b.code === bankCode);
    if (!bank) return;
    setSubmitting(true);
    setError(null);
    const res = await setupPayoutAccount({ accountNumber, bankCode, bankName: bank.name });
    setSubmitting(false);
    if (res.ok && res.accountName) onSaved(res.accountName);
    else setError(res.error ?? "Couldn't save that account.");
  };

  return (
    <div className="bg-white border border-stone-light rounded-sm p-5">
      <p className="text-sm font-semibold text-ink mb-3 flex items-center gap-1.5">
        <Landmark size={15} /> Add a payout account
      </p>
      <label className="text-xs font-semibold text-ink/80 block mb-1.5">Bank</label>
      <select
        value={bankCode}
        onChange={(e) => setBankCode(e.target.value)}
        className="w-full px-3 py-2.5 border-[1.5px] border-stone-light rounded bg-paper text-sm outline-none focus:border-indigo mb-3"
      >
        <option value="">{banks.length ? "Select your bank" : "Loading banks..."}</option>
        {banks.map((b) => (
          <option key={b.code} value={b.code}>
            {b.name}
          </option>
        ))}
      </select>

      <label className="text-xs font-semibold text-ink/80 block mb-1.5">Account number</label>
      <input
        value={accountNumber}
        onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
        maxLength={10}
        placeholder="0123456789"
        className="w-full px-3 py-2.5 border-[1.5px] border-stone-light rounded bg-paper text-sm outline-none focus:border-indigo mb-4"
      />

      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

      <button
        disabled={!bankCode || accountNumber.length !== 10 || submitting}
        onClick={submit}
        className="w-full bg-indigo disabled:bg-stone/40 text-white text-sm font-semibold py-2.5 rounded-sm"
      >
        {submitting ? "Verifying account..." : "Verify & save"}
      </button>
    </div>
  );
}

function StripePayoutSection({ connected }: { connected: boolean }) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    setConnecting(true);
    setError(null);
    const res = await startStripeOnboarding();
    setConnecting(false);
    if (res.ok && res.onboardingUrl) {
      window.location.href = res.onboardingUrl;
    } else {
      setError(res.error ?? "Couldn't start onboarding.");
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-display font-semibold text-ink mb-1">Payouts</h1>
      <p className="text-sm text-stone mb-5">
        You're on Stripe — payouts from your sales go straight to your bank account automatically,
        on Stripe's own schedule. No manual withdrawal step here.
      </p>

      {connected ? (
        <div className="bg-green/10 border border-green/20 rounded-sm p-5 flex items-start gap-3">
          <CheckCircle2 size={20} className="text-green shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-ink">Stripe account connected</p>
            <p className="text-xs text-ink/60 mt-1">
              Every order you get paid for splits automatically — GistVille's fee stays with the
              platform, the rest transfers to you at the moment of sale.
            </p>
            <button onClick={connect} className="text-xs font-semibold text-indigo mt-2 flex items-center gap-1">
              Manage account on Stripe <ExternalLink size={11} />
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-stone-light rounded-sm p-5">
          <p className="text-sm font-semibold text-ink mb-2">Connect your Stripe account</p>
          <p className="text-xs text-ink/60 mb-4">
            Required before you can receive payment for orders. Takes a few minutes — Stripe will
            ask for your bank details and identity verification directly.
          </p>
          {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
          <button
            onClick={connect}
            disabled={connecting}
            className="w-full bg-indigo disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-sm"
          >
            {connecting ? "Redirecting..." : "Connect with Stripe"}
          </button>
        </div>
      )}

      <p className="text-[11px] text-stone mt-5">
        Note: the gifting economy (virtual gifts, coins) is Paystack/Naira-only for now — it isn't
        available on Stripe-routed vendor accounts yet.
      </p>
    </div>
  );
}

export default function VendorGifts() {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<GiftTransaction[]>([]);
  const [orderEarnings, setOrderEarnings] = useState(0);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [payoutAccountName, setPayoutAccountName] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [payoutMessage, setPayoutMessage] = useState<string | null>(null);

  const isStripeVendor = profile?.payment_provider === "stripe";
  const ORDER_VENDOR_SHARE = 0.95; // 5% platform commission, matches vendor_available_balance() server-side

  const load = () => {
    if (!profile || isStripeVendor) return;
    Promise.all([
      fetchVendorGiftTransactions(profile.id),
      fetchAvailableBalance(profile.id),
      fetchVendorOrders(profile.id),
    ])
      .then(([txns, balance, orders]) => {
        setTransactions(txns);
        setAvailableBalance(balance);
        const paidNgnTotal = orders
          .filter((o) => o.paid && (o.currency ?? "NGN") === "NGN")
          .reduce((sum, o) => sum + Number(o.amount), 0);
        setOrderEarnings(Math.round(paidNgnTotal * ORDER_VENDOR_SHARE));
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [profile]);

  useEffect(() => {
    if (profile?.account_name) setPayoutAccountName(profile.account_name);
  }, [profile]);

  const giftTotal = vendorGiftEarningsTotal(transactions);
  const total = giftTotal + orderEarnings;

  const handleWithdraw = async () => {
    setWithdrawing(true);
    setPayoutMessage(null);
    const res = await requestPayout();
    setWithdrawing(false);
    if (res.ok) {
      setPayoutMessage(
        res.status === "success"
          ? `₦${res.amount?.toLocaleString()} sent to your account.`
          : `₦${res.amount?.toLocaleString()} withdrawal started — status: ${res.status}.`
      );
      load();
    } else {
      setPayoutMessage(res.error ?? "Withdrawal failed.");
    }
  };

  if (isStripeVendor) {
    return <StripePayoutSection connected={Boolean(profile?.stripe_account_id)} />;
  }

  return (
    <div>
      <h1 className="text-2xl font-display font-semibold text-ink mb-1">Earnings</h1>
      <p className="text-sm text-stone mb-5">Order sales and gifts from buyers.</p>

      <div className="bg-white border border-stone-light rounded-sm p-5 mb-4">
        <div className="flex justify-between">
          <div>
            <p className="text-xs font-semibold text-stone uppercase tracking-wide font-mono">
              Total earned
            </p>
            <p className="text-2xl font-display font-semibold text-ink mt-1">
              ₦{total.toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-stone uppercase tracking-wide font-mono">
              Available
            </p>
            <p className="text-2xl font-display font-semibold text-green mt-1">
              ₦{availableBalance.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex justify-between mt-3 pt-3 border-t border-stone-light text-xs text-ink/60">
          <span>Orders: ₦{orderEarnings.toLocaleString()} (95%)</span>
          <span>Gifts: ₦{giftTotal.toLocaleString()} (70%)</span>
        </div>
      </div>

      {payoutAccountName ? (
        <div className="bg-white border border-stone-light rounded-sm p-5 mb-6">
          <p className="text-sm font-semibold text-ink flex items-center gap-1.5 mb-3">
            <CheckCircle2 size={15} className="text-green" /> Payout account: {payoutAccountName}
          </p>
          <button
            onClick={handleWithdraw}
            disabled={withdrawing || availableBalance < 100}
            className="w-full bg-green disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-sm"
          >
            {withdrawing
              ? "Processing..."
              : availableBalance < 100
              ? "Balance too low to withdraw"
              : `Withdraw ₦${availableBalance.toLocaleString()}`}
          </button>
          {payoutMessage && <p className="text-xs text-stone mt-2.5 text-center">{payoutMessage}</p>}
        </div>
      ) : (
        <div className="mb-6">
          <PayoutSetup onSaved={setPayoutAccountName} />
        </div>
      )}

      {loading && <p className="text-sm text-stone">Loading...</p>}

      <p className="text-xs font-semibold text-stone uppercase tracking-wide font-mono mb-2">
        Recent gifts
      </p>

      {!loading && transactions.length === 0 && (
        <div className="bg-white border border-dashed border-stone-light rounded-sm p-10 text-center">
          <GiftIcon size={20} className="text-stone mx-auto mb-2" />
          <p className="text-sm text-stone">
            No gifts yet. Buyers can send gifts from your public profile page. (Order sales are in
            the Orders tab.)
          </p>
        </div>
      )}

      <div className="space-y-2.5">
        {transactions.map((t) => (
          <div
            key={t.id}
            className="bg-white border border-stone-light rounded-sm p-3.5 flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">{t.gift_catalog?.emoji ?? "🎁"}</span>
              <div>
                <p className="text-sm font-semibold text-ink">{t.gift_catalog?.name ?? "Gift"}</p>
                <p className="text-[11px] text-stone">{new Date(t.created_at).toLocaleString()}</p>
              </div>
            </div>
            <p className="text-sm font-display font-semibold text-green">
              +₦{Number(t.vendor_earning_ngn).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

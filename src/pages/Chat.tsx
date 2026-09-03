import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  X,
  Lock,
} from "lucide-react";
import { fetchVendorById, fileDispute, createOrder, verifyPaystackPayment, fetchOrderById } from "../lib/data";
import { payWithPaystack } from "../lib/paystack";
import { createStripeCheckout } from "../lib/stripe";
import { formatMoney, currencyForCountry } from "../lib/payments";
import { useAuth } from "../lib/auth";
import type { Vendor, OrderStatus } from "../types";
import { ORDER_STEPS } from "../types";

const STEP_LABELS: Record<OrderStatus, string> = {
  pending: "Order received",
  in_progress: "In progress",
  ready: "Ready for pickup/delivery",
  completed: "Completed",
};

const seedMessages = [
  { from: "vendor" as const, text: "Good afternoon! Yes, I can do the aso-ebi gown for your event." },
  { from: "buyer" as const, text: "Great. How much for a gown + gele combo?" },
  { from: "vendor" as const, text: "₦18,000 total. Ready in 5 days." },
  { from: "buyer" as const, text: "Okay, I'll go ahead and pay now." },
];

function DisputeModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    const res = await fileDispute(orderId, reason);
    setSubmitting(false);
    if (res.ok) setSent(true);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-20 flex items-end justify-center">
      <div className="w-full max-w-md bg-white rounded-t-2xl p-4 pb-6">
        {!sent ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-ink flex items-center gap-1.5">
                <AlertTriangle size={15} className="text-[#96760F]" /> Report an issue
              </p>
              <button onClick={onClose} aria-label="Close">
                <X size={18} className="text-stone" />
              </button>
            </div>
            <p className="text-xs text-[#5A5A6E] mb-2">
              Payment is held until you confirm delivery. Tell us what's wrong and we'll step in.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Order is late / not as described / vendor unresponsive"
              className="w-full h-20 bg-paper border border-stone-light rounded-lg p-2.5 text-sm resize-none outline-none"
            />
            <button
              disabled={!reason.trim() || submitting}
              onClick={submit}
              className="w-full mt-3 bg-ink disabled:bg-stone/40 text-white text-sm font-semibold py-2.5 rounded-lg"
            >
              {submitting ? "Submitting..." : "Submit report"}
            </button>
          </>
        ) : (
          <div className="text-center py-3">
            <CheckCircle2 size={28} className="text-green mx-auto" />
            <p className="text-sm font-semibold text-ink mt-2">Report sent</p>
            <p className="text-xs text-[#5A5A6E] mt-1">
              GistVille support will review within 24 hours. Your payment stays protected until this
              is resolved.
            </p>
            <button onClick={onClose} className="mt-4 text-xs font-semibold text-indigo">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Chat() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [paid, setPaid] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [status, setStatus] = useState<OrderStatus>("pending");
  const [showDispute, setShowDispute] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const isStripe = vendor?.payment_provider === "stripe";
  const ORDER_DESCRIPTION = "Gown + gele combo";
  const ORDER_AMOUNT = isStripe ? 20 : 18000;
  const ORDER_CURRENCY = isStripe ? currencyForCountry(vendor?.country) : "NGN";

  useEffect(() => {
    if (!id) return;
    fetchVendorById(id).then(setVendor);
  }, [id]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const returnedOrderId = params.get("order_id");
    if (params.get("stripe_success") !== "1" || !returnedOrderId) return;

    setOrderId(returnedOrderId);
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      const order = await fetchOrderById(returnedOrderId);
      if (order?.paid) {
        setPaid(true);
        setStatus(order.status);
        clearInterval(poll);
      } else if (attempts >= 8) {
        clearInterval(poll);
      }
    }, 2000);
    return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const stepIndex = ORDER_STEPS.indexOf(status);

  const refreshStatus = async () => {
    if (!orderId) return;
    setRefreshing(true);
    const order = await fetchOrderById(orderId);
    setRefreshing(false);
    if (order) setStatus(order.status);
  };

  const handlePay = async () => {
    if (!vendor) return;

    if (!profile || profile.role !== "buyer") {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
      return;
    }

    setPaying(true);
    setPayError(null);

    const orderRes = await createOrder({
      vendorId: vendor.id,
      buyerId: profile.id,
      buyerName: profile.name,
      buyerPhone: profile.phone,
      description: ORDER_DESCRIPTION,
      amount: ORDER_AMOUNT,
      currency: ORDER_CURRENCY,
    });
    if (!orderRes.ok || !orderRes.order) {
      setPayError(orderRes.error ?? "Couldn't create the order.");
      setPaying(false);
      return;
    }
    setOrderId(orderRes.order.id);

    if (isStripe) {
      const checkoutRes = await createStripeCheckout(orderRes.order.id);
      setPaying(false);
      if (!checkoutRes.ok || !checkoutRes.url) {
        setPayError(checkoutRes.error ?? "Couldn't start checkout.");
        return;
      }
      window.location.href = checkoutRes.url;
      return;
    }

    const payRes = await payWithPaystack({
      email: profile.email ?? `${profile.id}@gistville-buyer.local`,
      amountKobo: ORDER_AMOUNT * 100,
      metadata: { orderId: orderRes.order.id, vendorId: vendor.id, purpose: "order" },
    });
    if (!payRes.ok || !payRes.reference) {
      setPayError(payRes.error ?? "Payment was not completed.");
      setPaying(false);
      return;
    }

    const verifyRes = await verifyPaystackPayment({
      reference: payRes.reference,
      purpose: "order",
      orderId: orderRes.order.id,
    });
    setPaying(false);
    if (!verifyRes.ok) {
      setPayError(verifyRes.error ?? "Payment could not be verified. If you were charged, contact support.");
      return;
    }
    setPaid(true);
  };

  if (!vendor) return <p className="text-sm text-stone text-center py-16">Loading...</p>;

  return (
    <div className="flex flex-col min-h-screen bg-paper max-w-md mx-auto relative">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-light bg-white shrink-0 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={18} className="text-ink" />
        </button>
        <div className="w-8 h-8 rounded-full shrink-0" style={{ background: vendor.gradient }} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink truncate">{vendor.name}</p>
          <p className="text-[10px] text-green font-medium">Active now</p>
        </div>
        {paid && (
          <button
            onClick={() => setShowDispute(true)}
            className="text-[10px] font-semibold text-[#96760F] flex items-center gap-1"
          >
            <AlertTriangle size={12} /> Report
          </button>
        )}
      </div>

      <div className="flex-1 px-4 py-4 space-y-2.5">
        {seedMessages.map((m, i) => (
          <div key={i} className={`flex ${m.from === "buyer" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[75%] text-sm px-3 py-2 rounded-2xl ${
                m.from === "buyer"
                  ? "bg-indigo text-white rounded-br-sm"
                  : "bg-white border border-stone-light text-ink rounded-bl-sm"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        <div className="bg-white border border-stone-light rounded-xl p-3.5 mt-3">
          <p className="text-[10px] font-mono uppercase tracking-wide text-stone">Payment request</p>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-sm font-medium text-ink">{ORDER_DESCRIPTION}</span>
            <span className="text-base font-display font-semibold text-ink">
              {formatMoney(ORDER_AMOUNT, ORDER_CURRENCY)}
            </span>
          </div>
          {!paid ? (
            <>
              <button
                onClick={handlePay}
                disabled={paying}
                className="w-full mt-3 bg-green disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg flex items-center justify-center gap-1.5"
              >
                {!profile || profile.role !== "buyer" ? (
                  <>
                    <Lock size={13} /> Log in to pay
                  </>
                ) : paying ? (
                  "Processing..."
                ) : (
                  `Pay with ${isStripe ? "Stripe" : "Paystack"}`
                )}
              </button>
              {(!profile || profile.role !== "buyer") && (
                <p className="text-[11px] text-stone mt-2 text-center">
                  Orders are tied to your account so you can track them.{" "}
                  <Link to={`/signup?redirect=${encodeURIComponent(location.pathname)}`} className="text-indigo font-semibold">
                    Sign up
                  </Link>{" "}
                  if you're new.
                </p>
              )}
              {payError && <p className="text-xs text-red-600 mt-2">{payError}</p>}
            </>
          ) : (
            <div className="w-full mt-3 bg-green/10 text-green text-sm font-semibold py-2.5 rounded-lg text-center flex items-center justify-center gap-1.5">
              <ShieldCheck size={14} /> Paid — held until delivery confirmed
            </div>
          )}
        </div>

        {paid && (
          <div className="bg-white border border-stone-light rounded-xl p-3.5">
            <p className="text-[10px] font-mono uppercase tracking-wide text-stone mb-3">Order status</p>
            <div className="space-y-3">
              {ORDER_STEPS.map((step, i) => (
                <div key={step} className="flex items-center gap-2.5">
                  {i < stepIndex ? (
                    <CheckCircle2 size={16} className="text-green shrink-0" />
                  ) : i === stepIndex ? (
                    <span className="w-4 h-4 rounded-full border-2 border-indigo shrink-0 flex items-center justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo" />
                    </span>
                  ) : (
                    <Clock size={16} className="text-stone-light shrink-0" />
                  )}
                  <span className={`text-xs ${i <= stepIndex ? "text-ink font-medium" : "text-stone"}`}>
                    {STEP_LABELS[step]}
                  </span>
                </div>
              ))}
            </div>
            {stepIndex < ORDER_STEPS.length - 1 && (
              <button
                onClick={refreshStatus}
                disabled={refreshing}
                className="w-full mt-3.5 border border-stone-light text-[#5A5A6E] text-xs font-semibold py-2 rounded-lg disabled:opacity-60"
              >
                {refreshing ? "Checking..." : "Refresh status"}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="p-3 border-t border-stone-light bg-white flex items-center gap-2 shrink-0 sticky bottom-0">
        <div className="flex-1 bg-paper border border-stone-light rounded-full px-4 py-2.5 text-sm text-stone">
          Type a message...
        </div>
        <button className="w-9 h-9 rounded-full bg-indigo flex items-center justify-center shrink-0" aria-label="Send">
          <Send size={14} className="text-white" />
        </button>
      </div>

      {showDispute && orderId && <DisputeModal orderId={orderId} onClose={() => setShowDispute(false)} />}
    </div>
  );
}

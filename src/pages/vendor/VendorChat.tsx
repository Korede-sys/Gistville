import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Send, CheckCircle2, Clock } from "lucide-react";
import {
  fetchOrderById,
  fetchMessages,
  sendMessage,
  subscribeToMessages,
  updateOrderStatus,
} from "../../lib/data";
import { formatMoney } from "../../lib/payments";
import { useAuth } from "../../lib/auth";
import { ORDER_STEPS } from "../../types";
import type { Order, Message, OrderStatus } from "../../types";

const STEP_LABELS: Record<OrderStatus, string> = {
  pending: "Order received",
  in_progress: "In progress",
  ready: "Ready for pickup/delivery",
  completed: "Completed",
};

export default function VendorChat() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [notAuthorized, setNotAuthorized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!orderId || !profile) return;
    let cancelled = false;
    fetchOrderById(orderId).then((o) => {
      if (cancelled) return;
      if (!o || o.vendor_id !== profile.id) {
        setNotAuthorized(true);
        setLoading(false);
        return;
      }
      setOrder(o);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [orderId, profile]);

  useEffect(() => {
    if (!orderId || notAuthorized) return;
    fetchMessages(orderId).then(setMessages);
    const unsubscribe = subscribeToMessages(orderId, (message) => {
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    });
    return unsubscribe;
  }, [orderId, notAuthorized]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !orderId || sending) return;
    setSending(true);
    setDraft("");
    const res = await sendMessage(orderId, "vendor", text);
    setSending(false);
    if (!res.ok) setDraft(text);
  };

  const advance = async () => {
    if (!order) return;
    const currentIndex = ORDER_STEPS.indexOf(order.status);
    if (currentIndex >= ORDER_STEPS.length - 1) return;
    const next = ORDER_STEPS[currentIndex + 1];
    setUpdating(true);
    const res = await updateOrderStatus(order.id, next);
    setUpdating(false);
    if (res.ok) setOrder((prev) => (prev ? { ...prev, status: next } : prev));
  };

  if (loading) return <p className="text-sm text-stone text-center py-16">Loading...</p>;

  if (notAuthorized || !order) {
    return (
      <div className="max-w-md mx-auto py-16 text-center px-4">
        <p className="text-sm text-stone">This conversation isn't available.</p>
        <button onClick={() => navigate(-1)} className="mt-3 text-xs font-semibold text-indigo">
          Go back
        </button>
      </div>
    );
  }

  const stepIndex = ORDER_STEPS.indexOf(order.status);
  const isLast = stepIndex === ORDER_STEPS.length - 1;

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-2 pb-4">
        <button onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={18} className="text-ink" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-ink truncate">{order.buyer_name}</h1>
          <p className="text-[10px] text-stone font-medium truncate">{order.description}</p>
        </div>
        <span className="text-xs font-display font-semibold text-ink shrink-0">
          {formatMoney(order.amount, order.currency ?? "NGN")}
        </span>
      </div>

      <div className="bg-white border border-stone-light rounded-sm p-3.5 mb-4">
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
        {!isLast && (
          <button
            onClick={advance}
            disabled={updating}
            className="w-full mt-3.5 border border-stone-light text-ink/60 text-xs font-semibold py-2 rounded-sm disabled:opacity-60"
          >
            {updating ? "Updating..." : `Mark as "${STEP_LABELS[ORDER_STEPS[stepIndex + 1]]}"`}
          </button>
        )}
      </div>

      <div className="bg-white border border-stone-light rounded-sm flex flex-col h-[50vh]">
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
          {messages.length === 0 ? (
            <p className="text-xs text-stone text-center py-6">
              No messages yet — say hi to {order.buyer_name.split(" ")[0]}.
            </p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex ${m.sender === "vendor" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] text-sm px-3 py-2 rounded-2xl ${
                    m.sender === "vendor"
                      ? "bg-indigo text-white rounded-br-sm"
                      : "bg-white border border-stone-light text-ink rounded-bl-sm"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))
          )}
          <div ref={scrollRef} />
        </div>

        <div className="p-3 border-t border-stone-light flex items-center gap-2 shrink-0">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message..."
            className="flex-1 bg-paper border border-stone-light rounded-full px-4 py-2.5 text-sm text-ink placeholder:text-stone outline-none focus:border-indigo"
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            className="w-9 h-9 rounded-full bg-indigo disabled:opacity-40 flex items-center justify-center shrink-0"
            aria-label="Send"
          >
            <Send size={14} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

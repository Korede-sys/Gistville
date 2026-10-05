import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { fetchVendorOrders, updateOrderStatus } from "../../lib/data";
import { ORDER_STEPS } from "../../types";
import type { Order, OrderStatus } from "../../types";

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Order received",
  in_progress: "In progress",
  ready: "Ready",
  completed: "Completed",
};

const STATUS_TONE: Record<OrderStatus, string> = {
  pending: "bg-mustard/15 text-mustard",
  in_progress: "bg-indigo/10 text-indigo",
  ready: "bg-green/10 text-green",
  completed: "bg-stone/10 text-ink/60",
};

export default function VendorOrders() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = () => {
    if (!profile) return;
    fetchVendorOrders(profile.id)
      .then(setOrders)
      .finally(() => setLoading(false));
  };

  useEffect(load, [profile]);

  const advance = async (order: Order) => {
    const currentIndex = ORDER_STEPS.indexOf(order.status);
    if (currentIndex >= ORDER_STEPS.length - 1) return;
    const next = ORDER_STEPS[currentIndex + 1];
    setUpdatingId(order.id);
    const res = await updateOrderStatus(order.id, next);
    setUpdatingId(null);
    if (res.ok) {
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: next } : o)));
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-display font-semibold text-ink mb-5">Orders</h1>

      {loading && <p className="text-sm text-stone">Loading...</p>}

      {!loading && orders.length === 0 && (
        <div className="bg-white border border-dashed border-stone-light rounded-sm p-10 text-center">
          <p className="text-sm text-stone">No orders yet. They'll show up here once buyers pay.</p>
        </div>
      )}

      <div className="space-y-3">
        {orders.map((o) => {
          const isLast = ORDER_STEPS.indexOf(o.status) === ORDER_STEPS.length - 1;
          return (
            <div key={o.id} className="bg-white border border-stone-light rounded-sm p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink">{o.description}</p>
                  <p className="text-xs text-stone mt-0.5">{o.buyer_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-display font-semibold text-ink">
                    ₦{o.amount.toLocaleString()}
                  </p>
                  <span className={`tag-label text-[10px] px-2 py-0.5 rounded-sm ${STATUS_TONE[o.status]}`}>
                    {STATUS_LABEL[o.status]}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Link
                  to={`/vendor/orders/${o.id}/chat`}
                  className="flex items-center justify-center gap-1.5 border border-stone-light text-ink/60 text-xs font-semibold py-2 px-3 rounded-sm"
                >
                  <MessageCircle size={13} /> Message buyer
                </Link>
                {!isLast && (
                  <button
                    onClick={() => advance(o)}
                    disabled={updatingId === o.id}
                    className="flex-1 border border-stone-light text-ink/60 text-xs font-semibold py-2 rounded-sm disabled:opacity-60"
                  >
                    {updatingId === o.id
                      ? "Updating..."
                      : `Mark as "${STATUS_LABEL[ORDER_STEPS[ORDER_STEPS.indexOf(o.status) + 1]]}"`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

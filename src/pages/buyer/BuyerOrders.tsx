import { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth";
import { fetchBuyerOrders } from "../../lib/data";
import type { Order } from "../../types";

const STATUS_LABEL: Record<Order["status"], string> = {
  pending: "Order received",
  in_progress: "In progress",
  ready: "Ready",
  completed: "Completed",
};

export default function BuyerOrders() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    fetchBuyerOrders(profile.id)
      .then(setOrders)
      .finally(() => setLoading(false));
  }, [profile]);

  return (
    <div className="px-4 pb-4">
      <h2 className="text-lg font-semibold text-ink mb-3">Your orders</h2>

      {loading && <p className="text-sm text-stone text-center py-10">Loading...</p>}

      {!loading && orders.length === 0 && (
        <div className="bg-white border border-dashed border-stone-light rounded-sm p-8 text-center">
          <p className="text-sm text-stone">
            No orders yet. Orders you pay for through chat will show up here.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {orders.map((o) => (
          <div key={o.id} className="bg-white border border-stone-light rounded-sm p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-ink">{o.description}</p>
              <p className="text-sm font-display font-semibold text-ink">
                ₦{o.amount.toLocaleString()}
              </p>
            </div>
            <p className="text-xs text-stone mt-1">{STATUS_LABEL[o.status]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

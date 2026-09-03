import { useState } from "react";
import { AlertTriangle, CheckCircle2, Lock } from "lucide-react";

interface DisputeRow {
  id: string;
  order_id: string;
  reason: string;
  status: "open" | "resolved";
  created_at: string;
  orders: {
    id: string;
    description: string;
    amount: number;
    buyer_name: string;
    vendor_id: string;
    profiles: { business_name: string | null; name: string } | null;
  } | null;
}

export default function AdminDisputes() {
  const [code, setCode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const load = async (accessCode: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/disputes", { headers: { "x-admin-code": accessCode } });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Access denied.");
        setUnlocked(false);
        setLoading(false);
        return;
      }
      setDisputes(data.disputes ?? []);
      setUnlocked(true);
    } catch {
      setError("Couldn't reach the server.");
    }
    setLoading(false);
  };

  const resolve = async (disputeId: string) => {
    setResolvingId(disputeId);
    const res = await fetch("/api/admin/resolve-dispute", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-code": code },
      body: JSON.stringify({ disputeId }),
    });
    setResolvingId(null);
    if (res.ok) {
      setDisputes((prev) =>
        prev.map((d) => (d.id === disputeId ? { ...d, status: "resolved" } : d))
      );
    }
  };

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white border border-stone-light rounded-lg p-6 text-center">
          <Lock size={22} className="text-stone mx-auto mb-2" />
          <p className="text-sm font-semibold text-ink mb-4">Admin access</p>
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(code)}
            placeholder="Access code"
            className="w-full px-3.5 py-2.5 border-[1.5px] border-stone-light rounded bg-paper text-sm outline-none focus:border-indigo mb-3"
          />
          {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
          <button
            onClick={() => load(code)}
            disabled={!code || loading}
            className="w-full bg-indigo disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded"
          >
            {loading ? "Checking..." : "Unlock"}
          </button>
        </div>
      </div>
    );
  }

  const open = disputes.filter((d) => d.status === "open");
  const resolved = disputes.filter((d) => d.status === "resolved");

  return (
    <div className="min-h-screen bg-paper px-4 py-8 max-w-2xl mx-auto">
      <h1 className="text-xl font-display font-semibold text-ink mb-1">Disputes</h1>
      <p className="text-sm text-stone mb-6">{open.length} open · {resolved.length} resolved</p>

      {open.length === 0 && (
        <p className="text-sm text-stone bg-white border border-dashed border-stone-light rounded-lg p-6 text-center">
          No open disputes.
        </p>
      )}

      <div className="space-y-3 mb-8">
        {open.map((d) => (
          <div key={d.id} className="bg-white border border-mustard/30 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-[#96760F] shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink">
                  {d.orders?.description ?? "Order"} — ₦{d.orders?.amount.toLocaleString() ?? "?"}
                </p>
                <p className="text-xs text-stone mt-0.5">
                  Buyer: {d.orders?.buyer_name} · Vendor:{" "}
                  {d.orders?.profiles?.business_name || d.orders?.profiles?.name || "Unknown"}
                </p>
                <p className="text-sm text-[#4A4A5E] mt-2">{d.reason}</p>
                <p className="text-[10px] text-stone mt-1.5">
                  {new Date(d.created_at).toLocaleString()}
                </p>
              </div>
            </div>
            <button
              onClick={() => resolve(d.id)}
              disabled={resolvingId === d.id}
              className="w-full mt-3 border border-stone-light text-[#5A5A6E] text-xs font-semibold py-2 rounded-lg disabled:opacity-60"
            >
              {resolvingId === d.id ? "Resolving..." : "Mark resolved"}
            </button>
          </div>
        ))}
      </div>

      {resolved.length > 0 && (
        <>
          <p className="text-xs font-semibold text-stone uppercase tracking-wide font-mono mb-2">
            Resolved
          </p>
          <div className="space-y-2">
            {resolved.map((d) => (
              <div key={d.id} className="bg-white border border-stone-light rounded-lg p-3 flex items-start gap-2 opacity-70">
                <CheckCircle2 size={14} className="text-green shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs text-ink">{d.orders?.description ?? "Order"}</p>
                  <p className="text-[11px] text-stone">{d.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Lock } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [needsSetup, setNeedsSetup] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const loadDisputes = async (accessToken: string) => {
    const res = await fetch("/api/admin/disputes", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        setNeedsSetup(true);
        setError("Your account isn't an admin yet. Enter the setup code once to grant access.");
      } else {
        setError(data.error ?? "Access denied.");
      }
      return;
    }
    setToken(accessToken);
    setDisputes(data.disputes ?? []);
    setNeedsSetup(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase isn't configured in this environment.");
      setLoading(false);
      return;
    }
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError || !data.session) {
      setError(signInError?.message ?? "Login failed.");
      return;
    }
    await loadDisputes(data.session.access_token);
  };

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured || !supabase) return;
    setLoading(true);
    setError(null);
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      setLoading(false);
      setError("Session expired — log in again.");
      return;
    }
    const res = await fetch("/api/admin/bootstrap-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ code: setupCode }),
    });
    const body = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? "Setup code rejected.");
      return;
    }
    await loadDisputes(accessToken);
  };

  const resolve = async (disputeId: string) => {
    if (!token) return;
    setResolvingId(disputeId);
    const res = await fetch("/api/admin/resolve-dispute", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ disputeId }),
    });
    setResolvingId(null);
    if (res.ok) {
      setDisputes((prev) =>
        prev.map((d) => (d.id === disputeId ? { ...d, status: "resolved" } : d))
      );
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white border border-stone-light rounded-sm p-6 text-center">
          <Lock size={22} className="text-stone mx-auto mb-2" />
          <p className="tag-label text-sm text-ink mb-4">Admin access</p>

          {!needsSetup ? (
            <form onSubmit={handleLogin}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Admin email"
                autoComplete="username"
                className="w-full px-3.5 py-2.5 border-[1.5px] border-stone-light rounded-sm bg-paper text-sm outline-none focus:border-indigo mb-2"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                className="w-full px-3.5 py-2.5 border-[1.5px] border-stone-light rounded-sm bg-paper text-sm outline-none focus:border-indigo mb-3"
              />
              {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
              <button
                type="submit"
                disabled={!email || !password || loading}
                className="tag-label w-full bg-indigo disabled:opacity-60 text-white text-sm py-2.5 rounded-sm"
              >
                {loading ? "Checking..." : "Log in"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleBootstrap}>
              <p className="text-xs text-ink/60 mb-3">{error}</p>
              <input
                type="password"
                value={setupCode}
                onChange={(e) => setSetupCode(e.target.value)}
                placeholder="One-time setup code"
                className="w-full px-3.5 py-2.5 border-[1.5px] border-stone-light rounded-sm bg-paper text-sm outline-none focus:border-indigo mb-3"
              />
              <button
                type="submit"
                disabled={!setupCode || loading}
                className="tag-label w-full bg-indigo disabled:opacity-60 text-white text-sm py-2.5 rounded-sm"
              >
                {loading ? "Checking..." : "Grant admin access"}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const open = disputes.filter((d) => d.status === "open");
  const resolved = disputes.filter((d) => d.status === "resolved");

  return (
    <div className="min-h-screen bg-paper px-4 py-8 max-w-2xl mx-auto">
      <h1 className="text-xl font-display text-ink mb-1 uppercase">Disputes</h1>
      <p className="text-sm text-stone mb-6">{open.length} open · {resolved.length} resolved</p>

      {open.length === 0 && (
        <p className="text-sm text-stone bg-white border border-dashed border-stone-light rounded-sm p-6 text-center">
          No open disputes.
        </p>
      )}

      <div className="space-y-3 mb-8">
        {open.map((d) => (
          <div key={d.id} className="bg-white border border-mustard/30 rounded-sm p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-mustard shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink">
                  {d.orders?.description ?? "Order"} — ₦{d.orders?.amount.toLocaleString() ?? "?"}
                </p>
                <p className="text-xs text-stone mt-0.5">
                  Buyer: {d.orders?.buyer_name} · Vendor:{" "}
                  {d.orders?.profiles?.business_name || d.orders?.profiles?.name || "Unknown"}
                </p>
                <p className="text-sm text-ink/80 mt-2">{d.reason}</p>
                <p className="text-[10px] text-stone mt-1.5">
                  {new Date(d.created_at).toLocaleString()}
                </p>
              </div>
            </div>
            <button
              onClick={() => resolve(d.id)}
              disabled={resolvingId === d.id}
              className="tag-label w-full mt-3 border border-stone-light text-ink/70 text-xs py-2 rounded-sm disabled:opacity-60"
            >
              {resolvingId === d.id ? "Resolving..." : "Mark resolved"}
            </button>
          </div>
        ))}
      </div>

      {resolved.length > 0 && (
        <>
          <p className="tag-label text-xs text-stone mb-2">Resolved</p>
          <div className="space-y-2">
            {resolved.map((d) => (
              <div key={d.id} className="bg-white border border-stone-light rounded-sm p-3 flex items-start gap-2 opacity-70">
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

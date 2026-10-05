import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Coins as CoinsIcon, Sparkles } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { COIN_PACKAGES, buyCoinPackage } from "../../lib/gifting";
import { isSupabaseConfigured } from "../../lib/supabase";
import type { CoinPackage } from "../../types";

export default function Coins() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const [buying, setBuying] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleBuy = async (pkg: CoinPackage) => {
    if (!profile) return;
    setBuying(pkg.coins);
    setError(null);
    const res = await buyCoinPackage(profile.id, profile.email ?? `${profile.id}@gistville-buyer.local`, pkg);
    setBuying(null);
    if (!res.ok) {
      setError(res.error ?? "Purchase failed.");
      return;
    }
    await refreshProfile();
  };

  return (
    <div className="px-4 pb-4">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-stone mb-4">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="bg-gradient-to-br from-indigo to-indigo-deep rounded-sm p-5 text-white mb-6">
        <p className="text-xs opacity-80 uppercase tracking-wide font-mono">Your balance</p>
        <div className="flex items-center gap-2 mt-1">
          <CoinsIcon size={26} className="fill-mustard text-mustard" />
          <span className="text-3xl font-display font-semibold">{profile?.coin_balance ?? 0}</span>
          <span className="text-sm opacity-80">coins</span>
        </div>
      </div>

      {!isSupabaseConfigured && (
        <p className="text-xs text-stone bg-white border border-stone-light rounded-sm p-3 mb-4">
          Connect Supabase + Paystack to buy real coins — see README.
        </p>
      )}

      <p className="text-xs font-semibold text-stone uppercase tracking-wide font-mono mb-2">
        Buy coins
      </p>
      <div className="space-y-2.5">
        {COIN_PACKAGES.map((pkg) => (
          <button
            key={pkg.coins}
            onClick={() => handleBuy(pkg)}
            disabled={buying !== null}
            className="w-full bg-white border border-stone-light rounded-sm p-4 flex items-center justify-between disabled:opacity-60"
          >
            <div className="flex items-center gap-2">
              <CoinsIcon size={18} className="fill-mustard text-mustard" />
              <span className="text-sm font-semibold text-ink">{pkg.coins.toLocaleString()} coins</span>
              {pkg.bonus && (
                <span className="flex items-center gap-0.5 tag-label text-[10px] text-green bg-green/10 px-1.5 py-0.5 rounded-sm">
                  <Sparkles size={9} /> Bonus
                </span>
              )}
            </div>
            <span className="text-sm font-display font-semibold text-ink">
              {buying === pkg.coins ? "Processing..." : `₦${pkg.priceNgn.toLocaleString()}`}
            </span>
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

      <p className="text-[11px] text-stone text-center mt-6">
        Coins are used to send gifts to vendors. Not refundable, no cash-out for buyers.
      </p>
    </div>
  );
}

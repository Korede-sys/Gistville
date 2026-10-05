import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Star, ShieldCheck } from "lucide-react";
import { fetchSavedVendors } from "../../lib/data";
import { useAuth } from "../../lib/auth";
import type { Vendor } from "../../types";

export default function BuyerSaved() {
  const { profile } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }
    fetchSavedVendors(profile.id)
      .then(setVendors)
      .finally(() => setLoading(false));
  }, [profile]);

  return (
    <div className="px-4 pb-4">
      <h2 className="text-lg font-display text-ink mb-3 uppercase">Saved vendors</h2>

      {loading && <p className="text-sm text-stone text-center py-10">Loading...</p>}

      {!loading && vendors.length === 0 && (
        <div className="bg-white border border-dashed border-stone-light rounded-sm p-8 text-center">
          <p className="text-sm text-stone">
            Nothing saved yet — tap the bookmark on a vendor's profile to keep them here.
          </p>
          <Link to="/app" className="tag-label text-xs text-indigo mt-3 inline-block">
            Browse vendors
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {vendors.map((v) => (
          <Link
            key={v.id}
            to={`/app/vendor/${v.id}`}
            className="w-full text-left bg-white border border-stone-light rounded-sm overflow-hidden flex active:scale-[0.99] hover:border-ink transition"
          >
            <div className="w-20 h-20 shrink-0" style={{ background: v.gradient }} />
            <div className="p-3 flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-sm font-semibold text-ink truncate">{v.name}</h3>
                {v.verified && (
                  <span className="tag-label inline-flex items-center gap-0.5 text-[9px] bg-indigo text-white px-1.5 py-[1px] rounded-sm shrink-0">
                    <ShieldCheck size={10} /> Verified
                  </span>
                )}
              </div>
              <p className="text-xs text-stone mt-0.5">{v.category}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="flex items-center gap-0.5 text-[11px] text-ink font-medium">
                  <Star size={11} className="fill-mustard text-mustard" /> {v.rating}
                </span>
                <span className="flex items-center gap-0.5 text-[11px] text-stone">
                  <MapPin size={11} /> {v.area}
                </span>
              </div>
              <p className="price-chip text-[11px] bg-ink text-white px-1.5 py-0.5 rounded-sm mt-1.5 inline-block">
                {v.price_from}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

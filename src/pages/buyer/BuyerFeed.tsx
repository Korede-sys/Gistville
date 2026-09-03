import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, MapPin, Star, ShieldCheck, Zap } from "lucide-react";
import { fetchFeedListings, fetchVendors, fetchBoostedListings, recordAdImpression, recordAdClick } from "../../lib/data";
import type { BoostedListing } from "../../lib/data";
import type { Listing, Vendor } from "../../types";

export default function BuyerFeed() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [boosted, setBoosted] = useState<BoostedListing[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchFeedListings(), fetchVendors(), fetchBoostedListings()])
      .then(([l, v, b]) => {
        setListings(l);
        setVendors(v);
        setBoosted(b);
        b.forEach((item) => recordAdImpression(item.ad_campaign_id));
      })
      .finally(() => setLoading(false));
  }, []);

  const vendorById = Object.fromEntries(vendors.map((v) => [v.id, v]));
  const filteredVendors = vendors.filter(
    (v) =>
      !query ||
      v.name.toLowerCase().includes(query.toLowerCase()) ||
      v.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="px-4 pb-4">
      <div className="flex items-center gap-2 bg-white border border-stone-light rounded-lg px-3 py-2.5 mb-3">
        <Search size={16} className="text-stone shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tailors, makeup, gele..."
          className="w-full text-sm text-ink placeholder:text-stone bg-transparent outline-none"
        />
      </div>

      {loading && <p className="text-sm text-stone text-center py-10">Loading feed...</p>}

      {!loading && boosted.length > 0 && (
        <>
          <p className="text-xs font-semibold text-stone uppercase tracking-wide font-mono mb-2">
            Boosted
          </p>
          <div className="grid grid-cols-2 gap-2.5 mb-6">
            {boosted.map((l) => {
              const vendor = vendorById[l.vendor_id];
              return (
                <Link
                  key={l.id}
                  to={vendor ? `/app/vendor/${vendor.id}` : "#"}
                  onClick={() => recordAdClick(l.ad_campaign_id)}
                  className="bg-white border border-mustard/40 rounded-lg overflow-hidden relative"
                >
                  <span className="absolute top-1.5 left-1.5 z-10 flex items-center gap-0.5 bg-mustard text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full">
                    <Zap size={9} className="fill-white" /> Boosted
                  </span>
                  <div className="aspect-square bg-stone-light flex items-center justify-center text-stone text-xs">
                    {l.media_type === "video" ? "🎥 video" : "🖼 photo"}
                  </div>
                  <div className="p-2">
                    <p className="text-xs text-ink truncate">{l.caption}</p>
                    <p className="text-xs font-semibold text-green mt-0.5">{l.price}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {!loading && listings.length > 0 && (
        <>
          <p className="text-xs font-semibold text-stone uppercase tracking-wide font-mono mb-2">
            Fresh from vendors
          </p>
          <div className="grid grid-cols-2 gap-2.5 mb-6">
            {listings.map((l) => {
              const vendor = vendorById[l.vendor_id];
              return (
                <Link
                  key={l.id}
                  to={vendor ? `/app/vendor/${vendor.id}` : "#"}
                  className="bg-white border border-stone-light rounded-lg overflow-hidden"
                >
                  <div className="aspect-square bg-stone-light flex items-center justify-center text-stone text-xs">
                    {l.media_type === "video" ? "🎥 video" : "🖼 photo"}
                  </div>
                  <div className="p-2">
                    <p className="text-xs text-ink truncate">{l.caption}</p>
                    <p className="text-xs font-semibold text-green mt-0.5">{l.price}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      <p className="text-xs font-semibold text-stone uppercase tracking-wide font-mono mb-2">
        {listings.length > 0 ? "All vendors" : "Browse vendors"}
      </p>
      <div className="space-y-3">
        {filteredVendors.map((v) => (
          <Link
            key={v.id}
            to={`/app/vendor/${v.id}`}
            className="w-full text-left bg-white border border-stone-light rounded-xl overflow-hidden flex active:scale-[0.99] transition"
          >
            <div className="w-20 h-20 shrink-0" style={{ background: v.gradient }} />
            <div className="p-3 flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <h3 className="text-sm font-semibold text-ink truncate">{v.name}</h3>
                {v.verified && <ShieldCheck size={13} className="text-indigo shrink-0" />}
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
              <p className="text-xs font-semibold text-green mt-1">{v.price_from}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

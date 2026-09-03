import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, MapPin, Star, ShieldCheck, History } from "lucide-react";
import BottomNav from "../components/BottomNav";
import { fetchVendors } from "../lib/data";
import type { Vendor } from "../types";

const categories = ["All", "Tailoring", "Makeup", "Gele", "Wigs"];

export default function Market() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVendors()
      .then(setVendors)
      .finally(() => setLoading(false));
  }, []);

  const filtered = vendors.filter((v) => {
    const matchesCategory =
      activeCategory === "All" || v.category.toLowerCase().includes(activeCategory.toLowerCase());
    const matchesQuery =
      !query ||
      v.name.toLowerCase().includes(query.toLowerCase()) ||
      v.category.toLowerCase().includes(query.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="flex flex-col min-h-screen bg-paper max-w-md mx-auto">
      <div className="px-4 pt-6 pb-3">
        <p className="text-[11px] font-mono tracking-wide text-stone uppercase">
          Abuja · Fashion & Beauty
        </p>
        <h1 className="text-2xl font-display font-semibold text-ink mt-0.5">GistVille</h1>
      </div>

      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 bg-white border border-stone-light rounded-lg px-3 py-2.5">
          <Search size={16} className="text-stone shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tailors, makeup, gele..."
            className="w-full text-sm text-ink placeholder:text-stone bg-transparent outline-none"
          />
        </div>
      </div>

      <div className="flex gap-2 px-4 pb-3 overflow-x-auto">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setActiveCategory(c)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap border transition ${
              activeCategory === c
                ? "bg-ink text-white border-ink"
                : "border-stone-light text-[#5A5A6E]"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="flex-1 px-4 pb-4 space-y-3">
        {loading && <p className="text-sm text-stone text-center py-10">Loading vendors...</p>}

        {!loading && filtered.length === 0 && (
          <p className="text-sm text-stone text-center py-10">No vendors match that search yet.</p>
        )}

        {filtered.map((v) => (
          <Link
            key={v.id}
            to={`/app/vendor/${v.id}`}
            className="w-full text-left bg-white border border-stone-light rounded-xl overflow-hidden flex active:scale-[0.99] transition"
          >
            <div className="w-20 h-20 shrink-0 relative" style={{ background: v.gradient }}>
              <span
                className={`absolute bottom-1 left-1 w-2 h-2 rounded-full ring-2 ring-white ${
                  v.availability_status === "open" ? "bg-[#4ADE80]" : "bg-mustard"
                }`}
              />
            </div>
            <div className="p-3 flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <h3 className="text-sm font-semibold text-ink truncate">{v.name}</h3>
                {v.verified && <ShieldCheck size={13} className="text-indigo shrink-0" />}
                {v.previously_ordered && <History size={12} className="text-stone shrink-0" />}
              </div>
              <p className="text-xs text-stone mt-0.5">{v.category}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="flex items-center gap-0.5 text-[11px] text-ink font-medium">
                  <Star size={11} className="fill-mustard text-mustard" /> {v.rating}
                </span>
                <span className="text-[11px] text-stone">({v.reviews})</span>
                <span className="flex items-center gap-0.5 text-[11px] text-stone">
                  <MapPin size={11} /> {v.area}
                </span>
              </div>
              <p className="text-xs font-semibold text-green mt-1">{v.price_from}</p>
            </div>
          </Link>
        ))}
      </div>

      <BottomNav />
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { fetchVendorListings, fetchVendorOrders, fetchVendorAds } from "../../lib/data";

export default function VendorOverview() {
  const { profile } = useAuth();
  const [counts, setCounts] = useState({ listings: 0, orders: 0, ads: 0 });

  useEffect(() => {
    if (!profile) return;
    Promise.all([
      fetchVendorListings(profile.id),
      fetchVendorOrders(profile.id),
      fetchVendorAds(profile.id),
    ]).then(([listings, orders, ads]) =>
      setCounts({ listings: listings.length, orders: orders.length, ads: ads.length })
    );
  }, [profile]);

  return (
    <div>
      <h1 className="text-2xl font-display font-semibold text-ink mb-1">
        Welcome, {profile?.name?.split(" ")[0]}
      </h1>
      <p className="text-sm text-stone mb-6">Here's how {profile?.business_name} is doing.</p>

      <div
        className={`rounded-lg p-4 mb-6 flex items-center justify-between ${
          profile?.verified ? "bg-green/10" : "bg-mustard/10"
        }`}
      >
        <div className="flex items-center gap-2.5">
          {profile?.verified ? (
            <ShieldCheck size={20} className="text-green" />
          ) : (
            <ShieldOff size={20} className="text-[#96760F]" />
          )}
          <div>
            <p className="text-sm font-semibold text-ink">
              {profile?.verified ? "You're a verified vendor" : "Not verified yet"}
            </p>
            <p className="text-xs text-[#5A5A6E]">
              {profile?.verified
                ? "Your listings get priority placement in search."
                : "Verified vendors convert more browsers into buyers."}
            </p>
          </div>
        </div>
        {!profile?.verified && (
          <Link
            to="/vendor/verification"
            className="bg-indigo text-white text-xs font-semibold px-4 py-2 rounded-full whitespace-nowrap"
          >
            Get verified
          </Link>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Listings", value: counts.listings, to: "/vendor/listings" },
          { label: "Orders", value: counts.orders, to: "/vendor/orders" },
          { label: "Active ads", value: counts.ads, to: "/vendor/ads" },
        ].map((s) => (
          <Link
            key={s.label}
            to={s.to}
            className="bg-white border border-stone-light rounded-lg p-5 hover:border-indigo transition"
          >
            <p className="text-3xl font-display font-semibold text-ink">{s.value}</p>
            <p className="text-xs text-stone mt-1">{s.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

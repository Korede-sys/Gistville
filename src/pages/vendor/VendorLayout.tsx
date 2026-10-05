import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutGrid, Package, ShoppingBag, Megaphone, ShieldCheck, Gift, LogOut } from "lucide-react";
import { useAuth } from "../../lib/auth";

const tabs = [
  { to: "/vendor", label: "Overview", icon: LayoutGrid, end: true },
  { to: "/vendor/listings", label: "Listings", icon: Package },
  { to: "/vendor/orders", label: "Orders", icon: ShoppingBag },
  { to: "/vendor/ads", label: "Ads", icon: Megaphone },
  { to: "/vendor/gifts", label: "Earnings", icon: Gift },
  { to: "/vendor/verification", label: "Verification", icon: ShieldCheck },
];

export default function VendorLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-paper">
      <div className="sticky top-0 z-20 bg-white border-b border-stone-light">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-16">
          <div>
            <p className="font-display font-bold text-lg">
              Gist<span className="text-indigo">Ville</span>{" "}
              <span className="text-stone font-sans font-normal text-sm">· Vendor</span>
            </p>
            <p className="text-xs text-stone">{profile?.business_name || profile?.name}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-xs font-semibold text-stone hover:text-ink"
          >
            <LogOut size={14} /> Log out
          </button>
        </div>
        <div className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto pb-2">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 tag-label text-xs px-3 py-2 rounded-sm whitespace-nowrap ${
                    isActive ? "bg-ink text-white" : "text-ink/60 hover:bg-stone-light/60"
                  }`
                }
              >
                <Icon size={14} /> {t.label}
              </NavLink>
            );
          })}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </div>
    </div>
  );
}

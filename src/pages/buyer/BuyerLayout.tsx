import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import { Compass, ShoppingBag, Bookmark, Gamepad2, LogOut, Coins as CoinsIcon } from "lucide-react";
import { useAuth } from "../../lib/auth";

const tabs = [
  { to: "/buyer", label: "Feed", icon: Compass, end: true },
  { to: "/buyer/games", label: "Games", icon: Gamepad2 },
  { to: "/buyer/orders", label: "Orders", icon: ShoppingBag },
  { to: "/buyer/saved", label: "Saved", icon: Bookmark },
];

export default function BuyerLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="flex flex-col min-h-screen bg-paper max-w-md mx-auto">
      <div className="flex items-center justify-between px-4 pt-6 pb-2">
        <div>
          <p className="text-[11px] font-mono tracking-wide text-stone uppercase">
            Abuja · Fashion & Beauty
          </p>
          <h1 className="text-xl font-display font-semibold text-ink mt-0.5">
            Hi, {profile?.name?.split(" ")[0]}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/buyer/coins"
            className="flex items-center gap-1 bg-white border border-stone-light rounded-full px-2.5 py-1.5"
          >
            <CoinsIcon size={14} className="fill-mustard text-mustard" />
            <span className="text-xs font-semibold text-ink">{profile?.coin_balance ?? 0}</span>
          </Link>
          <button onClick={handleSignOut} className="text-stone hover:text-ink" aria-label="Log out">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1">
        <Outlet />
      </div>

      <div className="flex items-center justify-around py-2.5 border-t border-stone-light bg-white shrink-0">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 ${isActive ? "text-indigo" : "text-stone"}`
              }
            >
              <Icon size={19} />
              <span className="text-[9px] font-semibold">{t.label}</span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}

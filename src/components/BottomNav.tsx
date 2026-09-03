import { Link, useLocation } from "react-router-dom";
import { Home, Radio, MessageCircle, User } from "lucide-react";
import { useAuth } from "../lib/auth";

const tabs = [
  { key: "market", label: "Market", icon: Home, to: "/app" },
  { key: "requests", label: "Requests", icon: Radio, to: "/app/requests" },
];

export default function BottomNav() {
  const location = useLocation();
  const { profile } = useAuth();

  const profileTo = profile ? (profile.role === "vendor" ? "/vendor" : "/buyer") : "/login";
  const chatsTo = profile ? (profile.role === "vendor" ? "/vendor/orders" : "/buyer/orders") : "/login";

  const allTabs = [
    ...tabs,
    { key: "chats", label: "Chats", icon: MessageCircle, to: chatsTo },
    { key: "profile", label: profile ? "Dashboard" : "Log in", icon: User, to: profileTo },
  ];

  return (
    <div className="flex items-center justify-around py-2.5 border-t border-stone-light bg-white shrink-0">
      {allTabs.map((t) => {
        const Icon = t.icon;
        const active = location.pathname === t.to;
        return (
          <Link
            key={t.key}
            to={t.to}
            className={`flex flex-col items-center gap-0.5 ${
              active ? "text-indigo" : "text-stone"
            }`}
          >
            <Icon size={19} />
            <span className={`text-[9px] ${active ? "font-semibold" : ""}`}>
              {t.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

import { Link, useLocation } from "react-router-dom";
import { Home, Radio, MessageCircle, User } from "lucide-react";

const tabs = [
  { key: "market", label: "Market", icon: Home, to: "/app" },
  { key: "requests", label: "Requests", icon: Radio, to: "/app/requests" },
  { key: "chats", label: "Chats", icon: MessageCircle, to: "/app" },
  { key: "profile", label: "Profile", icon: User, to: "/app" },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <div className="flex items-center justify-around py-2.5 border-t border-stone-light bg-white shrink-0">
      {tabs.map((t) => {
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

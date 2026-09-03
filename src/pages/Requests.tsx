import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Radio } from "lucide-react";
import BottomNav from "../components/BottomNav";
import Badge from "../components/Badge";
import { fetchRequests } from "../lib/data";
import type { VendorRequest } from "../types";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function Requests() {
  const [requests, setRequests] = useState<VendorRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests()
      .then(setRequests)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-paper max-w-md mx-auto">
      <div className="px-4 pt-6 pb-3">
        <p className="text-[11px] font-mono tracking-wide text-stone uppercase">Buyer requests</p>
        <h1 className="text-2xl font-display font-semibold text-ink mt-0.5">What people need</h1>
      </div>

      <div className="flex-1 px-4 pb-4 space-y-3">
        {loading && <p className="text-sm text-stone text-center py-10">Loading requests...</p>}

        {!loading &&
          requests.map((r) => (
            <div key={r.id} className="bg-white border border-stone-light rounded-xl p-3.5">
              <p className="text-sm text-ink leading-snug">{r.text}</p>
              <div className="flex items-center justify-between mt-2.5">
                <div className="flex items-center gap-2 text-[11px] text-stone">
                  <span className="font-medium text-[#5A5A6E]">{r.poster_name}</span>
                  <span className="flex items-center gap-0.5">
                    <MapPin size={10} /> {r.area}
                  </span>
                  <span>{timeAgo(r.created_at)}</span>
                </div>
                <Badge tone={r.response_count > 2 ? "green" : "stone"}>
                  {r.response_count} responses
                </Badge>
              </div>
            </div>
          ))}
      </div>

      <div className="p-4 border-t border-stone-light bg-white">
        <Link
          to="/app/requests/new"
          className="w-full bg-indigo text-white text-sm font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
        >
          <Radio size={15} /> Post a request
        </Link>
      </div>

      <BottomNav />
    </div>
  );
}

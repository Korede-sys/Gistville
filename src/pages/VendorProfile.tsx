import { useEffect, useState } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { ArrowLeft, MapPin, Star, ShieldCheck, MessageCircle, Gift as GiftIcon, Lock } from "lucide-react";
import Badge from "../components/Badge";
import { fetchVendorById } from "../lib/data";
import { fetchGiftCatalog, sendGift } from "../lib/gifting";
import { useAuth } from "../lib/auth";
import type { Vendor, Gift } from "../types";

export default function VendorProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, refreshProfile } = useAuth();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [sendingGiftId, setSendingGiftId] = useState<string | null>(null);
  const [giftMessage, setGiftMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchVendorById(id)
      .then(setVendor)
      .finally(() => setLoading(false));
    fetchGiftCatalog().then(setGifts);
  }, [id]);

  const handleSendGift = async (gift: Gift) => {
    if (!vendor) return;
    if ((vendor.payment_provider ?? "paystack") !== "paystack") return;
    if (!profile || profile.role !== "buyer") {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
      return;
    }
    if (profile.coin_balance < gift.coin_cost) {
      setGiftMessage("Not enough coins — top up first.");
      return;
    }
    setSendingGiftId(gift.id);
    setGiftMessage(null);
    const res = await sendGift(profile.id, vendor.id, gift.id);
    setSendingGiftId(null);
    if (res.ok) {
      setGiftMessage(`Sent ${gift.emoji} ${gift.name}!`);
      await refreshProfile();
    } else {
      setGiftMessage(res.error ?? "Couldn't send that gift.");
    }
  };

  if (loading) {
    return <p className="text-sm text-stone text-center py-16">Loading...</p>;
  }

  if (!vendor) {
    return (
      <div className="max-w-md mx-auto px-4 py-10 text-center">
        <p className="text-sm text-stone">Vendor not found.</p>
        <Link to="/app" className="text-sm text-indigo font-semibold mt-2 inline-block">
          Back to market
        </Link>
      </div>
    );
  }

  const isOpen = vendor.availability_status === "open";

  return (
    <div className="flex flex-col min-h-screen bg-paper max-w-md mx-auto">
      <div className="h-40 relative shrink-0" style={{ background: vendor.gradient }}>
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-8 h-8 rounded-full bg-black/30 flex items-center justify-center backdrop-blur-sm"
          aria-label="Back"
        >
          <ArrowLeft size={16} className="text-white" />
        </button>
      </div>

      <div className="flex-1 px-4">
        <div className="pt-3 pb-2">
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-display font-semibold text-ink">{vendor.name}</h1>
            {vendor.verified && <ShieldCheck size={17} className="text-indigo" />}
          </div>

          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {vendor.verified && <Badge tone="indigo">Verified vendor</Badge>}
            <Badge tone="mustard">{vendor.category}</Badge>
            {vendor.previously_ordered && <Badge tone="stone">You ordered here before</Badge>}
          </div>

          <div className="flex items-center gap-3 mt-2 text-xs text-[#5A5A6E]">
            <span className="flex items-center gap-1">
              <Star size={12} className="fill-mustard text-mustard" /> {vendor.rating} ({vendor.reviews}{" "}
              reviews)
            </span>
            <span className="flex items-center gap-1">
              <MapPin size={12} /> {vendor.area}, Abuja
            </span>
          </div>

          <div
            className={`flex items-center gap-1.5 mt-2.5 text-xs font-medium ${
              isOpen ? "text-green" : "text-[#96760F]"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? "bg-green" : "bg-mustard"}`} />
            {vendor.availability_detail}
          </div>
        </div>

        {(vendor.payment_provider ?? "paystack") === "paystack" && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-stone uppercase tracking-wide font-mono flex items-center gap-1">
              <GiftIcon size={12} /> Send a gift
            </p>
            <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
              {gifts.map((g) => (
                <button
                  key={g.id}
                  onClick={() => handleSendGift(g)}
                  disabled={sendingGiftId !== null}
                  className="shrink-0 flex flex-col items-center gap-0.5 bg-white border border-stone-light rounded-lg px-3 py-2.5 disabled:opacity-60"
                >
                  <span className="text-xl">{g.emoji}</span>
                  <span className="text-[10px] font-semibold text-ink">{g.coin_cost}</span>
                </button>
              ))}
              {!profile || profile.role !== "buyer" ? (
                <div className="shrink-0 flex flex-col items-center justify-center gap-0.5 bg-paper border border-stone-light rounded-lg px-3 py-2.5 text-stone">
                  <Lock size={14} />
                  <span className="text-[9px]">Log in</span>
                </div>
              ) : null}
            </div>
            {giftMessage && <p className="text-xs text-indigo mt-1.5">{giftMessage}</p>}
          </div>
        )}

        <div className="mt-3">
          <p className="text-xs font-semibold text-stone uppercase tracking-wide font-mono">
            Menu &amp; pricing
          </p>
          <div className="mt-2 bg-white border border-stone-light rounded-lg divide-y divide-stone-light">
            {vendor.menu.map((m, i) => (
              <div key={i} className="flex items-center justify-between px-3.5 py-2.5">
                <span className="text-sm text-ink">{m.item}</span>
                <span className="text-sm font-semibold text-green">{m.price}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs font-semibold text-stone uppercase tracking-wide font-mono">
            Work from this stall
          </p>
          <div className="grid grid-cols-3 gap-1.5 mt-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-square rounded-md bg-stone-light" />
            ))}
          </div>
        </div>

        <div className="mt-4 mb-4">
          <p className="text-xs font-semibold text-stone uppercase tracking-wide font-mono">
            Recent review
          </p>
          <div className="mt-2 bg-white border border-stone-light rounded-lg p-3">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} size={11} className="fill-mustard text-mustard" />
              ))}
            </div>
            <p className="text-xs text-[#4A4A5E] mt-1.5">
              "Delivered my aso-ebi gown a day early, perfect fit. Will use again for the next owambe."
            </p>
            <p className="text-[10px] text-stone mt-1">— Chiamaka, Jabi</p>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-stone-light bg-white sticky bottom-0">
        <Link
          to={`/app/vendor/${vendor.id}/chat`}
          className="w-full bg-indigo text-white text-sm font-semibold py-3 rounded-lg flex items-center justify-center gap-2"
        >
          <MessageCircle size={15} /> Chat with {vendor.name.split(" ")[0]}
        </Link>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Megaphone, X } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { fetchVendorListings, fetchVendorAds, createAdCampaign, AD_PLATFORM_FEE_RATE } from "../../lib/data";
import type { Listing, AdCampaign } from "../../types";

function NewAdModal({
  vendorId,
  listings,
  onClose,
  onCreated,
}: {
  vendorId: string;
  listings: Listing[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [listingId, setListingId] = useState(listings[0]?.id ?? "");
  const [budget, setBudget] = useState(1000);
  const [submitting, setSubmitting] = useState(false);

  const platformCut = Math.round(budget * AD_PLATFORM_FEE_RATE);
  const reachBudget = budget - platformCut;

  const submit = async () => {
    setSubmitting(true);
    await createAdCampaign(vendorId, listingId, budget);
    setSubmitting(false);
    onCreated();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-ink">Boost a listing</p>
          <button onClick={onClose} aria-label="Close">
            <X size={18} className="text-stone" />
          </button>
        </div>

        {listings.length === 0 ? (
          <p className="text-sm text-stone">Create a listing first before boosting it.</p>
        ) : (
          <>
            <label className="text-xs font-semibold text-ink/80 block mb-1.5">Listing</label>
            <select
              value={listingId}
              onChange={(e) => setListingId(e.target.value)}
              className="w-full px-3 py-2.5 border-[1.5px] border-stone-light rounded bg-paper text-sm outline-none focus:border-indigo mb-4"
            >
              {listings.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.caption}
                </option>
              ))}
            </select>

            <label className="text-xs font-semibold text-ink/80 block mb-1.5">
              Budget (₦)
            </label>
            <input
              type="number"
              min={500}
              step={500}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-full px-3 py-2.5 border-[1.5px] border-stone-light rounded bg-paper text-sm outline-none focus:border-indigo mb-3"
            />

            <div className="bg-paper border border-stone-light rounded-sm p-3 mb-4 text-xs text-ink/60 space-y-1">
              <div className="flex justify-between">
                <span>Goes to reach (buyers who see this)</span>
                <span className="font-semibold text-ink">₦{reachBudget.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>GistVille platform fee ({Math.round(AD_PLATFORM_FEE_RATE * 100)}%)</span>
                <span className="font-semibold text-ink">₦{platformCut.toLocaleString()}</span>
              </div>
            </div>

            <button
              disabled={submitting}
              onClick={submit}
              className="w-full bg-indigo disabled:opacity-60 text-white text-sm font-semibold py-3 rounded-sm"
            >
              {submitting ? "Starting campaign..." : "Start boost"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function VendorAds() {
  const { profile } = useAuth();
  const [ads, setAds] = useState<AdCampaign[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!profile) return;
    Promise.all([fetchVendorAds(profile.id), fetchVendorListings(profile.id)]).then(
      ([a, l]) => {
        setAds(a);
        setListings(l);
      }
    ).finally(() => setLoading(false));
  };

  useEffect(load, [profile]);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-display font-semibold text-ink">Ads</h1>
          <p className="text-sm text-stone mt-1">
            Boost a listing to show up more often in the buyer feed.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-indigo text-white text-sm font-semibold px-4 py-2.5 rounded-sm flex items-center gap-1.5"
        >
          <Megaphone size={15} /> Boost listing
        </button>
      </div>

      {loading && <p className="text-sm text-stone">Loading...</p>}

      {!loading && ads.length === 0 && (
        <div className="bg-white border border-dashed border-stone-light rounded-sm p-10 text-center">
          <p className="text-sm text-stone">No active campaigns yet.</p>
        </div>
      )}

      <div className="space-y-3">
        {ads.map((a) => (
          <div key={a.id} className="bg-white border border-stone-light rounded-sm p-4">
            <div className="flex items-center justify-between">
              <span className="tag-label text-[10px] px-2 py-0.5 rounded-sm bg-green/10 text-green">
                {a.status}
              </span>
              <p className="text-sm font-display font-semibold text-ink">
                ₦{a.budget.toLocaleString()} budget
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3 text-center">
              <div>
                <p className="text-lg font-semibold text-ink">{a.impressions}</p>
                <p className="text-[10px] text-stone">Impressions</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-ink">{a.clicks}</p>
                <p className="text-[10px] text-stone">Clicks</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-ink">₦{a.spent.toLocaleString()}</p>
                <p className="text-[10px] text-stone">Spent</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && profile && (
        <NewAdModal
          vendorId={profile.id}
          listings={listings}
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            load();
          }}
        />
      )}
    </div>
  );
}

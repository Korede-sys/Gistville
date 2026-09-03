import { useEffect, useState } from "react";
import { Plus, Image as ImageIcon, Video, X, Upload } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { fetchVendorListings, createListing } from "../../lib/data";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import type { Listing, MediaType } from "../../types";

function NewListingModal({ vendorId, onClose, onCreated }: { vendorId: string; onClose: () => void; onCreated: () => void }) {
  const [mediaType, setMediaType] = useState<MediaType>("photo");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!file || !supabase) return;
    setSubmitting(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Your login session expired — please log in again.");
      setSubmitting(false);
      return;
    }

    const ext = file.name.split(".").pop() || (mediaType === "video" ? "mp4" : "jpg");
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadErr } = await supabase.storage.from("listings").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadErr) {
      setError(uploadErr.message);
      setSubmitting(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("listings").getPublicUrl(path);

    const res = await createListing({
      vendor_id: vendorId,
      media_type: mediaType,
      media_url: publicUrlData.publicUrl,
      caption,
      price,
    });
    setSubmitting(false);
    if (res.ok) onCreated();
    else setError(res.error ?? "Something went wrong.");
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-ink">New listing</p>
          <button onClick={onClose} aria-label="Close">
            <X size={18} className="text-stone" />
          </button>
        </div>

        {!isSupabaseConfigured ? (
          <p className="text-sm text-stone">
            Uploading media needs Supabase Storage connected — set VITE_SUPABASE_URL /
            VITE_SUPABASE_ANON_KEY (already provisioned, see README) and this unlocks.
          </p>
        ) : (
          <>
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => {
              setMediaType("photo");
              setFile(null);
              setPreviewUrl(null);
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded border-[1.5px] text-sm font-semibold ${
              mediaType === "photo" ? "border-indigo bg-indigo text-white" : "border-stone-light text-ink"
            }`}
          >
            <ImageIcon size={14} /> Photo
          </button>
          <button
            onClick={() => {
              setMediaType("video");
              setFile(null);
              setPreviewUrl(null);
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded border-[1.5px] text-sm font-semibold ${
              mediaType === "video" ? "border-indigo bg-indigo text-white" : "border-stone-light text-ink"
            }`}
          >
            <Video size={14} /> Video
          </button>
        </div>

        <label className="text-xs font-semibold text-[#4A4A5E] block mb-1.5">
          {mediaType === "photo" ? "Photo" : "Video"}
        </label>
        <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-stone-light rounded-lg py-6 mb-3 cursor-pointer hover:border-indigo transition">
          {previewUrl ? (
            mediaType === "photo" ? (
              <img src={previewUrl} alt="Preview" className="max-h-32 rounded" />
            ) : (
              <video src={previewUrl} className="max-h-32 rounded" controls />
            )
          ) : (
            <>
              <Upload size={20} className="text-stone" />
              <span className="text-xs text-stone">Tap to choose a {mediaType}</span>
            </>
          )}
          <input
            type="file"
            accept={mediaType === "photo" ? "image/*" : "video/*"}
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        <label className="text-xs font-semibold text-[#4A4A5E] block mb-1.5">Caption</label>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="w-full h-20 px-3 py-2.5 border-[1.5px] border-stone-light rounded bg-paper text-sm outline-none focus:border-indigo resize-none mb-3"
        />

        <label className="text-xs font-semibold text-[#4A4A5E] block mb-1.5">Price</label>
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="e.g. ₦15,000"
          className="w-full px-3 py-2.5 border-[1.5px] border-stone-light rounded bg-paper text-sm outline-none focus:border-indigo mb-4"
        />

        {error && <p className="text-[12px] text-red-600 mb-3">{error}</p>}

        <button
          disabled={!file || !caption.trim() || !price.trim() || submitting}
          onClick={submit}
          className="w-full bg-indigo disabled:bg-stone/40 text-white text-sm font-semibold py-3 rounded-lg"
        >
          {submitting ? "Uploading..." : "Post listing"}
        </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function VendorListings() {
  const { profile } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!profile) return;
    fetchVendorListings(profile.id)
      .then(setListings)
      .finally(() => setLoading(false));
  };

  useEffect(load, [profile]);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-display font-semibold text-ink">Listings</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-indigo text-white text-sm font-semibold px-4 py-2.5 rounded-lg flex items-center gap-1.5"
        >
          <Plus size={15} /> New listing
        </button>
      </div>

      {loading && <p className="text-sm text-stone">Loading...</p>}

      {!loading && listings.length === 0 && (
        <div className="bg-white border border-dashed border-stone-light rounded-lg p-10 text-center">
          <p className="text-sm text-stone">
            No listings yet. Post a photo or video of your work to appear in the buyer feed.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {listings.map((l) => (
          <div key={l.id} className="bg-white border border-stone-light rounded-lg overflow-hidden">
            <div className="aspect-square bg-stone-light flex items-center justify-center text-stone text-xs">
              {l.media_type === "video" ? "🎥 video" : "🖼 photo"}
            </div>
            <div className="p-2.5">
              <p className="text-xs text-ink truncate">{l.caption}</p>
              <p className="text-xs font-semibold text-green mt-0.5">{l.price}</p>
            </div>
          </div>
        ))}
      </div>

      {showModal && profile && (
        <NewListingModal
          vendorId={profile.id}
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

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { createVendorRequest } from "../lib/data";

export default function PostRequest() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [area, setArea] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!text.trim() || !area.trim()) return;
    setSubmitting(true);
    setError(null);
    const res = await createVendorRequest(text.trim(), area.trim());
    setSubmitting(false);
    if (res.ok) {
      navigate("/app/requests");
    } else {
      setError(res.error ?? "Something went wrong. Try again.");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-paper max-w-md mx-auto">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-light bg-white shrink-0">
        <button onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={18} className="text-ink" />
        </button>
        <p className="text-sm font-semibold text-ink">New request</p>
      </div>

      <div className="flex-1 px-4 py-4">
        <label className="text-xs font-semibold text-ink/60 block mb-1.5">What do you need?</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Need a gele stylist for Saturday, Wuse area, budget ₦10k"
          className="w-full h-28 bg-white border border-stone-light rounded-sm p-3 text-sm text-ink resize-none outline-none"
        />

        <label className="text-xs font-semibold text-ink/60 block mb-1.5 mt-4">Area</label>
        <input
          value={area}
          onChange={(e) => setArea(e.target.value)}
          placeholder="e.g. Wuse, Garki, Lugbe"
          className="w-full bg-white border border-stone-light rounded-sm p-3 text-sm text-ink outline-none"
        />

        <p className="text-[11px] text-stone mt-2">
          Matching vendors in your area get notified instantly.
        </p>

        {error && <p className="text-[11px] text-red-600 mt-2">{error}</p>}
      </div>

      <div className="p-4 border-t border-stone-light bg-white">
        <button
          disabled={!text.trim() || !area.trim() || submitting}
          onClick={submit}
          className="w-full bg-indigo disabled:bg-stone/40 text-white text-sm font-semibold py-3 rounded-sm"
        >
          {submitting ? "Posting..." : "Post to nearby vendors"}
        </button>
      </div>
    </div>
  );
}

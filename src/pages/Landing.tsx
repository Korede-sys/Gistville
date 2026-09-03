import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { submitWaitlistEntry } from "../lib/data";

const categories = [
  "Tailoring / Fashion design",
  "Makeup artistry",
  "Aso-ebi / Gele styling",
  "Wigs / Hair vendor",
  "Other beauty or fashion",
];

export default function Landing() {
  const [role, setRole] = useState<"vendor" | "buyer">("vendor");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [area, setArea] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await submitWaitlistEntry({
      name,
      phone,
      role,
      category: role === "vendor" ? category : undefined,
      area,
    });
    setSubmitting(false);
    if (res.ok) setSubmitted(true);
    else setError(res.error ?? "Something went wrong. Try again.");
  };

  return (
    <div className="bg-paper text-ink min-h-screen">
      <nav className="sticky top-0 z-50 bg-paper/90 backdrop-blur border-b border-stone-light">
        <div className="max-w-[1080px] mx-auto px-6 h-[68px] flex items-center justify-between">
          <div className="font-display font-bold text-xl">
            Gist<span className="text-indigo">Ville</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/app" className="text-sm font-semibold text-[#5A5A6E]">
              Browse app
            </Link>
            <a
              href="#waitlist"
              className="bg-ink text-paper px-4 py-2 rounded text-sm font-semibold"
            >
              Join waitlist
            </a>
          </div>
        </div>
      </nav>

      <header className="max-w-[1080px] mx-auto px-6 pt-20 pb-16">
        <div className="flex flex-wrap gap-2 mb-7">
          {["Tailors", "Makeup artists", "Aso-ebi & gele", "Wig vendors", "Abuja"].map((t) => (
            <span
              key={t}
              className="font-mono text-[11px] uppercase tracking-wide px-3 py-1 border border-stone rounded-full text-stone"
            >
              {t}
            </span>
          ))}
        </div>
        <h1 className="font-display font-semibold text-[clamp(2.2rem,6vw,4rem)] leading-[1.05] max-w-3xl">
          Every vendor here <span className="text-indigo italic font-medium">sabi</span> their craft.
        </h1>
        <p className="mt-5 text-lg text-[#4A4A5E] max-w-xl">
          The directory, chat and payment app for Abuja's fashion &amp; beauty vendors — where buyers
          know exactly who to trust, and vendors get paid without wahala.
        </p>
        <div className="mt-9 flex flex-wrap gap-3.5">
          <a
            href="#waitlist"
            onClick={() => setRole("vendor")}
            className="bg-indigo hover:bg-indigo-deep transition text-white px-7 py-3.5 rounded font-semibold"
          >
            I'm a vendor — join free
          </a>
          <a
            href="#waitlist"
            onClick={() => setRole("buyer")}
            className="border-[1.5px] border-ink hover:bg-ink hover:text-paper transition px-7 py-3.5 rounded font-semibold"
          >
            I want to shop
          </a>
        </div>
      </header>

      <section className="max-w-[1080px] mx-auto px-6 py-20">
        <div className="font-mono text-xs uppercase tracking-widest text-indigo mb-2.5">
          How it works
        </div>
        <h2 className="font-display font-semibold text-[clamp(1.8rem,4vw,2.6rem)] max-w-xl mb-12">
          Three moves, not a whole learning curve.
        </h2>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            {
              n: "01",
              title: "Set up your stall",
              body: "Post your work — photos, prices, turnaround time. Buyers see your reviews before they ever DM you.",
            },
            {
              n: "02",
              title: "Chat, agree, pay",
              body: "Buyers message you in-app and pay upfront or on delivery. No more \u201cI've sent the money\u201d screenshots.",
            },
            {
              n: "03",
              title: "Get your money",
              body: "Payouts land in your account within 24 hours via Paystack. No chasing, no delay.",
            },
          ].map((s) => (
            <div key={s.n} className="bg-white border border-stone-light rounded p-7">
              <div className="font-mono text-xs text-mustard font-bold">{s.n}</div>
              <h3 className="text-xl font-semibold mt-3 mb-2.5">{s.title}</h3>
              <p className="text-sm text-[#5A5A6E]">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-ink text-paper py-20">
        <div className="max-w-[1080px] mx-auto px-6">
          <div className="font-mono text-xs uppercase tracking-widest text-mustard mb-2.5">
            What it costs
          </div>
          <h2 className="font-display font-semibold text-[clamp(1.8rem,4vw,2.6rem)] text-white">
            Free to start. Pay when you're earning.
          </h2>
          <div className="grid md:grid-cols-3 gap-px bg-white/10 border border-white/10 rounded overflow-hidden mt-8">
            {[
              { amount: "Free", unit: "", title: "Basic stall", body: "List your work, chat with buyers, appear in category search. No monthly fee." },
              { amount: "₦1,000", unit: "/month", title: "Verified badge", body: "Blue check, priority placement in your category, and buyer trust that converts to sales." },
              { amount: "5%", unit: " per sale", title: "In-app payment", body: "Only charged when you actually get paid through GistVille. Cash deals stay free." },
            ].map((p) => (
              <div key={p.title} className="bg-ink p-8">
                <div className="font-display font-semibold text-4xl text-mustard">
                  {p.amount}
                  <small className="font-sans text-base text-[#B8B8C8] font-normal">{p.unit}</small>
                </div>
                <h4 className="text-base mt-3.5 mb-2">{p.title}</h4>
                <p className="text-sm text-[#A8A8BC]">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="waitlist" className="max-w-[1080px] mx-auto px-6 py-20">
        <div className="text-center mb-10">
          <div className="font-mono text-xs uppercase tracking-widest text-indigo mb-2.5">
            Join the first wave
          </div>
          <h2 className="font-display font-semibold text-[clamp(1.8rem,4vw,2.6rem)]">
            Abuja fashion &amp; beauty vendors — this one's for you first.
          </h2>
        </div>

        <div className="bg-white border border-stone-light rounded-lg p-10 max-w-xl mx-auto">
          {!submitted ? (
            <form onSubmit={handleSubmit}>
              <div className="flex gap-2.5 mb-6">
                <button
                  type="button"
                  onClick={() => setRole("vendor")}
                  className={`flex-1 py-3.5 border-[1.5px] rounded font-semibold text-sm transition ${
                    role === "vendor"
                      ? "border-indigo bg-indigo text-white"
                      : "border-stone-light bg-paper text-ink"
                  }`}
                >
                  I'm a vendor
                </button>
                <button
                  type="button"
                  onClick={() => setRole("buyer")}
                  className={`flex-1 py-3.5 border-[1.5px] rounded font-semibold text-sm transition ${
                    role === "buyer"
                      ? "border-indigo bg-indigo text-white"
                      : "border-stone-light bg-paper text-ink"
                  }`}
                >
                  I want to shop
                </button>
              </div>

              <div className="mb-4">
                <label className="block text-[13px] font-semibold text-[#4A4A5E] mb-1.5">
                  Full name
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Amaka Chukwu"
                  className="w-full px-3.5 py-3 border-[1.5px] border-stone-light rounded bg-paper text-sm outline-none focus:border-indigo"
                />
              </div>

              <div className="mb-4">
                <label className="block text-[13px] font-semibold text-[#4A4A5E] mb-1.5">
                  WhatsApp number
                </label>
                <input
                  required
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="080X XXX XXXX"
                  className="w-full px-3.5 py-3 border-[1.5px] border-stone-light rounded bg-paper text-sm outline-none focus:border-indigo"
                />
              </div>

              {role === "vendor" && (
                <div className="mb-4">
                  <label className="block text-[13px] font-semibold text-[#4A4A5E] mb-1.5">
                    What do you sell?
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-3 border-[1.5px] border-stone-light rounded bg-paper text-sm outline-none focus:border-indigo"
                  >
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-[13px] font-semibold text-[#4A4A5E] mb-1.5">
                  Area in Abuja
                </label>
                <input
                  required
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="e.g. Wuse 2, Garki, Lugbe"
                  className="w-full px-3.5 py-3 border-[1.5px] border-stone-light rounded bg-paper text-sm outline-none focus:border-indigo"
                />
              </div>

              {error && <p className="text-[12px] text-red-600 mb-3">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-indigo hover:bg-indigo-deep disabled:opacity-60 transition text-white font-semibold py-3.5 rounded"
              >
                {submitting ? "Joining..." : "Join the waitlist"}
              </button>
              <p className="text-[13px] text-stone text-center mt-3.5">
                No payment now. We'll message you on WhatsApp when your area opens up.
              </p>
            </form>
          ) : (
            <div className="text-center py-5">
              <CheckCircle2 size={36} className="text-green mx-auto" />
              <h3 className="text-lg font-semibold mt-3">You're on the list</h3>
              <p className="text-sm text-[#5A5A6E] mt-1.5">
                We'll reach out on WhatsApp within a few days with next steps.
              </p>
            </div>
          )}
        </div>
      </section>

      <footer className="py-10 border-t border-stone-light text-center text-stone text-sm">
        GistVille — starting in Abuja, one category at a time.
      </footer>
    </div>
  );
}

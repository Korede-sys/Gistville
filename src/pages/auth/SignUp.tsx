import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { COUNTRIES, providerForCountry } from "../../lib/payments";
import type { Role } from "../../types";

const categories = [
  "Tailoring / Fashion design",
  "Makeup artistry",
  "Aso-ebi / Gele styling",
  "Wigs / Hair vendor",
  "Other beauty or fashion",
];

export default function SignUp() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get("redirect");
  const { signUp } = useAuth();

  const [role, setRole] = useState<Role>("buyer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [area, setArea] = useState("");
  const [country, setCountry] = useState("NG");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await signUp({
      name,
      email,
      password,
      role,
      businessName: role === "vendor" ? businessName : undefined,
      category: role === "vendor" ? category : undefined,
      area,
      country: role === "vendor" ? country : undefined,
    });
    setSubmitting(false);
    if (res.ok) navigate(redirect || (role === "vendor" ? "/vendor" : "/buyer"));
    else setError(res.error ?? "Something went wrong.");
  };

  const provider = providerForCountry(country);

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white border border-stone-light rounded-lg p-8">
        <div className="font-display font-bold text-xl mb-1">
          Gist<span className="text-indigo">Ville</span>
        </div>
        <h1 className="text-lg font-semibold text-ink mb-5">Create your account</h1>

        {redirect ? (
          <p className="text-xs text-stone bg-paper border border-stone-light rounded-lg px-3 py-2.5 mb-6">
            Creating a buyer account so you can complete your order.
          </p>
        ) : (
          <div className="flex gap-2.5 mb-6">
            <button
              type="button"
              onClick={() => setRole("buyer")}
              className={`flex-1 py-3 border-[1.5px] rounded font-semibold text-sm transition ${
                role === "buyer" ? "border-indigo bg-indigo text-white" : "border-stone-light text-ink"
              }`}
            >
              I want to shop
            </button>
            <button
              type="button"
              onClick={() => setRole("vendor")}
              className={`flex-1 py-3 border-[1.5px] rounded font-semibold text-sm transition ${
                role === "vendor" ? "border-indigo bg-indigo text-white" : "border-stone-light text-ink"
              }`}
            >
              I'm a vendor
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-semibold text-[#4A4A5E] mb-1.5">Full name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-3 border-[1.5px] border-stone-light rounded bg-paper text-sm outline-none focus:border-indigo"
            />
          </div>

          {role === "vendor" && (
            <>
              <div>
                <label className="block text-[13px] font-semibold text-[#4A4A5E] mb-1.5">
                  Business name
                </label>
                <input
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Amaka's Stitch House"
                  className="w-full px-3.5 py-3 border-[1.5px] border-stone-light rounded bg-paper text-sm outline-none focus:border-indigo"
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#4A4A5E] mb-1.5">
                  Category
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
              <div>
                <label className="block text-[13px] font-semibold text-[#4A4A5E] mb-1.5">
                  Country
                </label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-3.5 py-3 border-[1.5px] border-stone-light rounded bg-paper text-sm outline-none focus:border-indigo"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-stone mt-1.5">
                  You'll get paid via {provider === "paystack" ? "Paystack" : "Stripe"} based on this.
                </p>
              </div>
            </>
          )}

          <div>
            <label className="block text-[13px] font-semibold text-[#4A4A5E] mb-1.5">
              City / Area
            </label>
            <input
              required
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder={role === "vendor" ? "e.g. Wuse 2, Abuja" : "e.g. your city"}
              className="w-full px-3.5 py-3 border-[1.5px] border-stone-light rounded bg-paper text-sm outline-none focus:border-indigo"
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#4A4A5E] mb-1.5">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-3 border-[1.5px] border-stone-light rounded bg-paper text-sm outline-none focus:border-indigo"
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#4A4A5E] mb-1.5">Password</label>
            <input
              required
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-3 border-[1.5px] border-stone-light rounded bg-paper text-sm outline-none focus:border-indigo"
            />
          </div>

          {error && <p className="text-[12px] text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-indigo hover:bg-indigo-deep disabled:opacity-60 transition text-white font-semibold py-3 rounded"
          >
            {submitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="text-sm text-stone text-center mt-5">
          Already have an account?{" "}
          <Link to="/login" className="text-indigo font-semibold">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../lib/auth";

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get("redirect");
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await signIn(email, password);
    setSubmitting(false);
    if (res.ok) {
      navigate(redirect || (res.profile?.role === "vendor" ? "/vendor" : "/buyer"));
    } else {
      setError(res.error ?? "Something went wrong.");
    }
  };

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white border border-stone-light rounded-sm p-8">
        <div className="font-display font-bold text-xl mb-1">
          Gist<span className="text-indigo">Ville</span>
        </div>
        <h1 className="text-lg font-semibold text-ink mb-5">Log in</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-semibold text-ink/80 mb-1.5">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-3 border-[1.5px] border-stone-light rounded bg-paper text-sm outline-none focus:border-indigo"
            />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-ink/80 mb-1.5">Password</label>
            <input
              required
              type="password"
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
            {submitting ? "Logging in..." : "Log in"}
          </button>
        </form>

        <p className="text-sm text-stone text-center mt-5">
          No account yet?{" "}
          <Link to={redirect ? `/signup?redirect=${encodeURIComponent(redirect)}` : "/signup"} className="text-indigo font-semibold">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

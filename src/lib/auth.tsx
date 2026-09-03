import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase, isSupabaseConfigured } from "./supabase";
import { providerForCountry } from "./payments";
import type { Profile, Role } from "../types";

interface SignUpInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  businessName?: string;
  category?: string;
  area?: string;
  country?: string;
}

interface AuthContextValue {
  profile: Profile | null;
  loading: boolean;
  signUp: (input: SignUpInput) => Promise<{ ok: boolean; error?: string; profile?: Profile }>;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string; profile?: Profile }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const MOCK_KEY = "gistville_mock_profile";

function readMockProfile(): Profile | null {
  const raw = localStorage.getItem(MOCK_KEY);
  return raw ? (JSON.parse(raw) as Profile) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setProfile(readMockProfile());
      setLoading(false);
      return;
    }

    // Captured into a local const so TS can prove non-null inside the async
    // closures below (narrowing on the imported `supabase` binding doesn't
    // reliably survive across a .then()/async boundary).
    const client = supabase;

    client.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        const { data: prof } = await client
          .from("profiles")
          .select("*")
          .eq("auth_user_id", data.session.user.id)
          .single();
        setProfile((prof as Profile) ?? null);
      }
      setLoading(false);
    });

    const { data: sub } = client.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const { data: prof } = await client
          .from("profiles")
          .select("*")
          .eq("auth_user_id", session.user.id)
          .single();
        setProfile((prof as Profile) ?? null);
      } else {
        setProfile(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signUp: AuthContextValue["signUp"] = async (input) => {
    if (!isSupabaseConfigured || !supabase) {
      const mockProfile: Profile = {
        id: crypto.randomUUID(),
        role: input.role,
        name: input.name,
        email: input.email,
        business_name: input.businessName,
        category: input.category,
        area: input.area,
        country: input.country,
        payment_provider: input.country ? providerForCountry(input.country) : undefined,
        verified: false,
        verified_until: null,
        coin_balance: input.role === "buyer" ? 100 : 0,
        created_at: new Date().toISOString(),
      };
      localStorage.setItem(MOCK_KEY, JSON.stringify(mockProfile));
      setProfile(mockProfile);
      return { ok: true, profile: mockProfile };
    }

    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
    });
    if (error || !data.user) return { ok: false, error: error?.message ?? "Sign up failed" };

    const { error: profileError } = await supabase.from("profiles").insert({
      auth_user_id: data.user.id,
      role: input.role,
      name: input.name,
      email: input.email,
      business_name: input.businessName ?? null,
      category: input.category ?? null,
      area: input.area ?? null,
      country: input.country ?? null,
      payment_provider: input.country ? providerForCountry(input.country) : null,
      verified: false,
    });
    if (profileError) return { ok: false, error: profileError.message };

    const { data: prof } = await supabase
      .from("profiles")
      .select("*")
      .eq("auth_user_id", data.user.id)
      .single();
    setProfile((prof as Profile) ?? null);
    return { ok: true, profile: (prof as Profile) ?? undefined };
  };

  const signIn: AuthContextValue["signIn"] = async (email, password) => {
    if (!isSupabaseConfigured || !supabase) {
      const existing = readMockProfile();
      if (!existing) return { ok: false, error: "No mock account found — sign up first." };
      setProfile(existing);
      return { ok: true, profile: existing };
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return { ok: false, error: error?.message ?? "Sign in failed" };

    const { data: prof } = await supabase
      .from("profiles")
      .select("*")
      .eq("auth_user_id", data.user.id)
      .single();
    setProfile((prof as Profile) ?? null);
    return { ok: true, profile: (prof as Profile) ?? undefined };
  };

  const signOut = async () => {
    if (!isSupabaseConfigured || !supabase) {
      localStorage.removeItem(MOCK_KEY);
      setProfile(null);
      return;
    }
    await supabase.auth.signOut();
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setProfile(readMockProfile());
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: prof } = await supabase
      .from("profiles")
      .select("*")
      .eq("auth_user_id", user.id)
      .single();
    if (prof) setProfile(prof as Profile);
  };

  return (
    <AuthContext.Provider value={{ profile, loading, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

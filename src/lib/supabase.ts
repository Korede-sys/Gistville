import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// `supabase` is null until VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set
// (in Vercel project env vars, or a local .env.local). The app falls back to
// mock data everywhere it reads through src/lib/data.ts, so it runs fully
// standalone before the database is wired up.
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export const isSupabaseConfigured = Boolean(supabase);

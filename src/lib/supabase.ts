import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";
const isTestMode = import.meta.env.MODE === "test";

export const supabaseConfig = {
  url: supabaseUrl,
  hasPublishableKey: Boolean(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()),
  hasLegacyAnonKey: Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()),
  isConfigured: !isTestMode && Boolean(supabaseUrl && supabaseKey)
};

export const supabase: SupabaseClient | null = supabaseConfig.isConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true
      }
    })
  : null;

export type WrenSession = Session;

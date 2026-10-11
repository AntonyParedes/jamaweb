import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function getSupabaseConfig() {
  const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;
  if (!url || !key) return null;
  try {
    if (new URL(url).protocol !== "https:") return null;
  } catch {
    return null;
  }
  // Private server keys must never be supplied to a VITE_* variable.
  if (key.startsWith("sb_secret_")) return null;
  try {
    const payload = key.split(".")[1];
    if (payload && JSON.parse(atob(payload)).role === "service_role") return null;
  } catch {
    // Modern publishable keys are not JWTs.
  }
  return { url, key };
}

let browserClient: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  const config = getSupabaseConfig();
  if (!config) return null;
  browserClient ??= createClient(config.url, config.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return browserClient;
}

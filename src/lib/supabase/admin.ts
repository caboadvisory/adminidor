import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

// Service-role client — bypasses RLS and can use the Auth admin API.
// SERVER ONLY. Never import this into client components; only use it inside
// admin-gated server actions / route handlers.
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export function isAdminApiConfigured(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);
}

export function createAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

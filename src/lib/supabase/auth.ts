import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "./config";
import { createClient } from "./server";

export async function getCurrentUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

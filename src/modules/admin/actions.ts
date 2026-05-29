"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { createAdminClient, isAdminApiConfigured } from "@/lib/supabase/admin";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createUserSchema, updateUserSchema } from "./schema";

export type AdminActionResult = { ok: true } | { ok: false; error: string };

const BAN_DURATION = "876000h"; // ~100 years = effectively deactivated

async function requireAdmin(): Promise<{ userId: string } | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") return null;
  return { userId: user.id };
}

async function revalidateAdmin() {
  const locale = await getLocale();
  revalidatePath(`/${locale}/admin`);
}

export async function createUser(input: unknown): Promise<AdminActionResult> {
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "forbidden" };
  if (!isAdminApiConfigured()) return { ok: false, error: "not_configured" };

  const client = createAdminClient();
  const { data, error } = await client.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });
  if (error || !data.user) {
    return { ok: false, error: error?.message ?? "create_failed" };
  }

  // The signup trigger creates a profile (role 'member'); set the chosen fields.
  const { error: profileError } = await client
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      role: parsed.data.role,
      locale: parsed.data.locale,
    })
    .eq("id", data.user.id);
  if (profileError) return { ok: false, error: profileError.message };

  await revalidateAdmin();
  return { ok: true };
}

export async function updateUser(
  id: string,
  input: unknown,
): Promise<AdminActionResult> {
  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "forbidden" };
  if (!isAdminApiConfigured()) return { ok: false, error: "not_configured" };

  // Lockout protection: can't demote yourself.
  if (id === admin.userId && parsed.data.role !== "admin") {
    return { ok: false, error: "self_role" };
  }

  const client = createAdminClient();
  const { error: profileError } = await client
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      role: parsed.data.role,
      locale: parsed.data.locale,
    })
    .eq("id", id);
  if (profileError) return { ok: false, error: profileError.message };

  if (parsed.data.password) {
    const { error } = await client.auth.admin.updateUserById(id, {
      password: parsed.data.password,
    });
    if (error) return { ok: false, error: error.message };
  }

  await revalidateAdmin();
  return { ok: true };
}

export async function setUserActive(
  id: string,
  active: boolean,
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "forbidden" };
  if (!isAdminApiConfigured()) return { ok: false, error: "not_configured" };

  // Lockout protection: can't deactivate yourself.
  if (id === admin.userId && !active) {
    return { ok: false, error: "self_deactivate" };
  }

  const client = createAdminClient();
  const { error } = await client.auth.admin.updateUserById(id, {
    ban_duration: active ? "none" : BAN_DURATION,
  });
  if (error) return { ok: false, error: error.message };

  await revalidateAdmin();
  return { ok: true };
}

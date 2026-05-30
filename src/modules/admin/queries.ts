import { createAdminClient } from "@/lib/supabase/admin";
import { isCurrentUserAdmin } from "@/lib/supabase/auth";
import type { AdminUser, UserRole } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

function isActive(bannedUntil: string | null | undefined): boolean {
  if (!bannedUntil) return true;
  return new Date(bannedUntil).getTime() <= Date.now();
}

function toAdminUser(u: any, profile: any): AdminUser {
  return {
    id: u.id,
    email: u.email ?? "",
    fullName: profile?.full_name ?? null,
    role: (profile?.role ?? "member") as UserRole,
    locale: profile?.locale ?? "en",
    active: isActive(u.banned_until),
    createdAt: u.created_at,
  };
}

export async function listUsers(): Promise<AdminUser[]> {
  // Gate the RLS-bypassing service-role access at the data layer, not just at
  // the calling page — this function enumerates every user's email.
  if (!(await isCurrentUserAdmin())) throw new Error("forbidden");

  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) throw error;

  const { data: profiles, error: pErr } = await admin
    .from("profiles")
    .select("id, full_name, role, locale");
  if (pErr) throw pErr;

  const profMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  return data.users
    .map((u: any) => toAdminUser(u, profMap.get(u.id)))
    .sort((a, b) => a.email.localeCompare(b.email));
}

export async function getAdminUser(id: string): Promise<AdminUser | null> {
  if (!(await isCurrentUserAdmin())) throw new Error("forbidden");

  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.getUserById(id);
  if (error || !data?.user) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, role, locale")
    .eq("id", id)
    .maybeSingle();

  return toAdminUser(data.user, profile);
}

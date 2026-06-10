"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { projectInputSchema, type ProjectInput } from "./schema";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreateResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

async function getUserAndRole() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, isAdmin: false };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return { supabase, user, isAdmin: profile?.role === "admin" };
}

async function revalidateProject(id?: string) {
  const locale = await getLocale();
  revalidatePath(`/${locale}/projects`);
  if (id) revalidatePath(`/${locale}/projects/${id}`);
}

function projectRow(input: ProjectInput) {
  return {
    client_id: input.clientId,
    name: input.name,
    code: input.code,
    status: input.status,
    hourly_rate: input.hourlyRate,
    currency: input.currency,
    billing_type: input.billingType,
    fixed_price: input.fixedPrice,
    start_date: input.startDate,
    end_date: input.endDate,
  };
}

export async function createProject(input: unknown): Promise<CreateResult> {
  const parsed = projectInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const { supabase, user, isAdmin } = await getUserAndRole();
  if (!user || !isAdmin) return { ok: false, error: "forbidden" };

  const { data, error } = await supabase
    .from("projects")
    .insert({ ...projectRow(parsed.data), created_by: user.id })
    .select("id")
    .single();

  if (error) return { ok: false, error: "generic" };

  await revalidateProject(data.id);
  return { ok: true, id: data.id };
}

export async function updateProject(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const parsed = projectInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const { supabase, user, isAdmin } = await getUserAndRole();
  if (!user || !isAdmin) return { ok: false, error: "forbidden" };

  const { data: updated, error } = await supabase
    .from("projects")
    .update(projectRow(parsed.data))
    .eq("id", id)
    .select("id");

  if (error) return { ok: false, error: "generic" };
  if (!updated || updated.length === 0) return { ok: false, error: "forbidden" };

  await revalidateProject(id);
  return { ok: true };
}

export async function deleteProject(id: string): Promise<ActionResult> {
  const { supabase, user, isAdmin } = await getUserAndRole();
  if (!user || !isAdmin) return { ok: false, error: "forbidden" };

  const { data: deleted, error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: "generic" };
  if (!deleted || deleted.length === 0) return { ok: false, error: "forbidden" };

  await revalidateProject(id);
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { timeEntryInputSchema } from "./schema";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreateResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

async function getUser() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

async function revalidate(projectId?: string | null) {
  const locale = await getLocale();
  revalidatePath(`/${locale}/time`);
  if (projectId) revalidatePath(`/${locale}/projects/${projectId}`);
}

// Effective rate = project hourly rate, else the client's base rate.
async function resolveRate(
  supabase: any,
  projectId: string,
): Promise<number | null> {
  const { data } = await supabase
    .from("projects")
    .select("hourly_rate, clients(default_hourly_rate)")
    .eq("id", projectId)
    .maybeSingle();
  if (!data) return null;
  const projectRate = data.hourly_rate == null ? null : Number(data.hourly_rate);
  const clientRate =
    data.clients?.default_hourly_rate == null
      ? null
      : Number(data.clients.default_hourly_rate);
  return projectRate ?? clientRate;
}

function computeAmount(
  rate: number | null,
  minutes: number,
  override: number | null,
): number | null {
  if (override != null) return override;
  if (rate == null) return null;
  return Math.round(rate * (minutes / 60) * 100) / 100;
}

export async function createTimeEntry(input: unknown): Promise<CreateResult> {
  const parsed = timeEntryInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "forbidden" };

  const minutes = Math.round(parsed.data.hours * 60);
  const rate = await resolveRate(supabase, parsed.data.projectId);
  const amount = computeAmount(rate, minutes, parsed.data.amount);

  const { data, error } = await supabase
    .from("time_entries")
    .insert({
      project_id: parsed.data.projectId,
      user_id: user.id,
      work_date: parsed.data.workDate,
      minutes,
      description: parsed.data.description,
      billable: parsed.data.billable,
      unit_rate: rate,
      amount,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  await revalidate(parsed.data.projectId);
  return { ok: true, id: data.id };
}

export async function updateTimeEntry(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const parsed = timeEntryInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "forbidden" };

  const minutes = Math.round(parsed.data.hours * 60);
  const rate = await resolveRate(supabase, parsed.data.projectId);
  const amount = computeAmount(rate, minutes, parsed.data.amount);

  const { error } = await supabase
    .from("time_entries")
    .update({
      project_id: parsed.data.projectId,
      work_date: parsed.data.workDate,
      minutes,
      description: parsed.data.description,
      billable: parsed.data.billable,
      unit_rate: rate,
      amount,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  await revalidate(parsed.data.projectId);
  return { ok: true };
}

export async function deleteTimeEntry(id: string): Promise<ActionResult> {
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "forbidden" };

  const { data: existing } = await supabase
    .from("time_entries")
    .select("project_id")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("time_entries").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await revalidate(existing?.project_id ?? null);
  return { ok: true };
}

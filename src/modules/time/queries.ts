import { createClient } from "@/lib/supabase/server";
import type { TimeEntry, TimeEntryListItem } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const LIST_SELECT =
  "id, project_id, user_id, work_date, minutes, description, billable, amount, projects(name, currency), profiles(full_name)";

function mapListItem(row: any): TimeEntryListItem {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.projects?.name ?? null,
    currency: row.projects?.currency ?? null,
    userId: row.user_id,
    userName: row.profiles?.full_name ?? null,
    workDate: row.work_date,
    minutes: row.minutes,
    description: row.description,
    billable: row.billable,
    amount: row.amount == null ? null : Number(row.amount),
  };
}

export async function listTimeEntriesByUser(
  userId: string,
): Promise<TimeEntryListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("time_entries")
    .select(LIST_SELECT)
    .eq("user_id", userId)
    .order("work_date", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapListItem);
}

export async function listTimeEntriesByProject(
  projectId: string,
): Promise<TimeEntryListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("time_entries")
    .select(LIST_SELECT)
    .eq("project_id", projectId)
    .order("work_date", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapListItem);
}

export async function getTimeEntry(id: string): Promise<TimeEntry | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("time_entries")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    projectId: data.project_id,
    userId: data.user_id,
    workDate: data.work_date,
    minutes: data.minutes,
    description: data.description,
    billable: data.billable,
    unitRate: data.unit_rate == null ? null : Number(data.unit_rate),
    amount: data.amount == null ? null : Number(data.amount),
    createdAt: data.created_at,
  };
}
